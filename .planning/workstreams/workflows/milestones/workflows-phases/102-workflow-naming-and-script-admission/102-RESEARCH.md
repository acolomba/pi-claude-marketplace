# Phase 102: Workflow naming and script admission - Research

**Researched:** 2026-08-14
**Domain:** Static JS source analysis (acorn AST + token/comment ranges), pure-domain decision functions, npm dependency declaration
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Module placement and the 102-to-103 seam**

- Both the `meta` extractor and the engine pre-validator live in **one new pure
  module, `domain/workflow-script.ts`**. Both are pure functions over a source
  string with no disk and no network, which is exactly what `domain/` is for.
  `bridges/workflows/` does not exist until Phase 103, so placing them there
  would mean creating a bridge directory this phase cannot use.
- This phase delivers a **pure admission decision**:
  `(pluginName, fileName, source) -> verdict`. Phase 102 owns the decision and
  its tests; Phase 103 wires it into discover/stage and routes the refusal
  reasons into the bridge's `warnings[]` channel. No skeletal bridge file is
  created now.
- The AST walk also extracts **`meta.description`** and returns it alongside
  `name`. WBRG-01's envelope needs it in Phase 103; parsing a second time there
  would be waste, and re-editing this walk would be churn. Phase 102 itself does
  not consume the description.
- The name collision (WNAM-05) throws a **plain `Error`** whose message mirrors
  `assertNoCommandCollisions` (`bridges/commands/stage.ts:77`) -- generated name
  followed by the bracketed list of offending sources. WNAM-05 says "mirroring"
  that helper; nothing narrows on it via `instanceof`, and it fails the install
  through the ledger's existing catch. No typed error class is added.

**Extractor outcomes and collision scope**

- The extractor returns a **discriminated union over a closed outcome
  discriminant**: `named` / `stem-fallback` / `skipped` / `refused`. The spike
  prototype's free-form `reason` strings do not survive into production -- the
  caller must branch exhaustively, which is the codebase's union + `assertNever`
  idiom.
- `export const meta = someFactory()` -- **`meta` declared but not an object
  literal** -- is **`skipped`**, identical to no `meta` at all. Roadmap SC 2 does
  not name this case, so it is decided here: the name is unreadable, and a stem
  fallback would install a possibly-wrong command name, which is the precise
  failure WNAM-01 exists to prevent.
- An **unparseable script (`refused`) skips the file, not the plugin**. The
  remaining workflows and the plugin still install. This mirrors WVAL-02 and the
  Core Value's "degradation never blocks the install": one broken file in a
  twenty-script plugin must not block the other nineteen.
- **Collision detection runs over the whole plugin's discovered set, before any
  dedup, and hard-errors.** This deliberately **diverges** from the commands
  bridge: `discoverPluginCommands` first-wins-dedups by generated name (D-07)
  before `assertNoCommandCollisions` ever sees the set, which makes that assert
  unreachable from the discover path in practice. For commands a clash can only
  arise from prefix elision, which the two filenames make legible. For workflows
  the clash comes from `meta.name`, so neither filename reveals it, and silently
  keeping the first is exactly the silent misnaming WNAM-05 forbids.

**Pre-validation fidelity and the rejection message**

- The engine's determinism blocklist is **vendored as a copy**, not imported.
  `@quintinshaw/pi-dynamic-workflows` is absent from `node_modules` and is a
  runtime-probed soft dependency -- there is nothing to import from. The regex
  becomes a named constant whose comment records the measured engine version
  (3.5.1) and that it copies a private internal.
- **Only `DETERMINISM_BLOCKLIST` is replicated**, not the rest of
  `parseWorkflowScript`. It is the only text-level gate that was measured; the
  remainder of that function is acorn parsing the extractor already performs.
  Replicating unmeasured 0.x internals would invent failure modes.
- WVAL-03's "real reason" is produced from the **AST already in hand**: collect
  comment ranges via acorn's `onComment`, plus string-literal ranges from the
  tree, then test whether the blocklist match index falls inside one. A match in
  code and a match confined to a comment are reported as distinct reasons. This
  is the mechanism that stops us repeating the engine's own misattribution.
- A **comment-only match still skips the script**. The engine rejects it
  wholesale either way, so installing it would produce a command that cannot
  run. The code-versus-comment distinction changes only the message, which gains
  the actionable remedy: the host's check is raw text, so rewording the comment
  makes the script load.

### Claude's Discretion

- Exported symbol names, the exact discriminant spelling, and message wording,
  subject to `.claude/rules/typescript-comments.md` (requirement and decision IDs
  stay; planning-artifact references are forbidden).
- Whether the string-literal ranges are gathered during the same walk that finds
  `meta` or by a separate pass, provided one `parse()` call serves both.
- Test file placement and fixture naming, subject to the "extend existing files
  where one fits" habit established in Phase 101.

### Deferred Ideas (OUT OF SCOPE)

- The `bridges/workflows/` discover/stage/unstage triplet, the JSON envelope,
  canonical paths, the NFR-10 root amendment, adjacent staging, and the sixth
  ledger phase -- Phase 103.
- Routing these verdicts into a live `warnings[]` channel and surfacing them to
  the user -- Phase 103.
- Update, uninstall, reinstall and enable/disable parity -- Phase 104.
- The `workflow_control` probe, the third `DEPENDENCIES` member, the new
  `REASONS` token and its catalog entry -- Phase 105.
- Measuring quintinshaw's `agent()` failure semantics (null versus throw), which
  spike 022a left open because driving it needs real spawn machinery -- WDOC-01
  in Phase 105 documents the uncertainty rather than resolving it.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WNAM-01 | Command name comes from `meta.name`, extracted by a static acorn AST walk; never a regex, never by evaluation | Verified acorn skeleton (Code Examples §1) typechecks and lints clean in this repo; comment/string decoy classification verified live (§Code Examples 2) |
| WNAM-02 | No `name` property, or a non-string-literal `name`, falls back to the file stem; the value is never evaluated | Two distinct extractor arms; both collapse to `stem-fallback`. Engine-side consequence recorded in Open Question 1 |
| WNAM-03 | No `meta` declaration -> skipped with a warning, not installed | Third arm `skipped`; CONTEXT extends it to `meta` present but not an object literal |
| WNAM-04 | Unparseable script (acorn `SyntaxError`) -> refused, not name-scavenged | Fourth arm `refused`; `parse()` throw is the only trigger. Ordering pinned in Pattern 1 |
| WNAM-05 | Two scripts in one plugin resolving to the same name -> explicit collision error mirroring `assertNoCommandCollisions` (RN-6) | Template read verbatim at `bridges/commands/stage.ts:77-101`; D-07 dedup divergence confirmed at `bridges/commands/discover.ts:100-104` |
| WNAM-06 | `<plugin>:<name>` from `generatedColonName`, reused unchanged; no `:`-sanitizing step | `generatedColonName` read at `domain/name.ts:90-103`; engine validator read from the shipped tarball -- two gaps found that a wrapper must close (Pitfall 1) |
| WVAL-01 | Every script validated against the engine's text-level preprocessor **before** the install commits | `DETERMINISM_BLOCKLIST` read verbatim from `dist/workflow.js:35`; engine only runs it at workflow *invocation*, never at save or registration (verified) |
| WVAL-02 | A rejected script is skipped and reported; remaining workflows and the plugin still install | Per-file verdict shape; no throw on the pre-validation arm |
| WVAL-03 | The rejection names the offending script and the real reason, including a raw-text match that fired on a comment | `onComment` + `onToken` classification verified live against the engine's exact regex (Code Examples §2) |
| WDOC-03 | `acorn` (8.16.0) declared as the fourth runtime dependency | Exact two-hunk `package-lock.json` diff verified by dry run (Change Map rows 1-2) |

</phase_requirements>

## Summary

This phase has exactly three production surfaces and no I/O: a new pure module
`domain/workflow-script.ts`, one new exported generator in `domain/name.ts`, and
a one-line `dependencies` addition in `package.json`. Everything else is tests.
The mechanism is settled — the spike prototype at
`sources/026-meta-name-extraction/extract.mjs` already works, and this research
verified that its exact shape typechecks and lints clean under this repo's
`strictTypeChecked` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
configuration with only two changes (optional chaining instead of explicit
null-checks, and a narrowing guard on `Property.key`).

Two findings change what the plan must contain. First, `assertSafeName` does
**not** subsume the engine's `isSafeSavedWorkflowName`: the engine additionally
requires `name.length <= 128` and `name.trim() === name`, neither of which
`assertSafeName` enforces. Roadmap SC 4 ("every generated name passes the
engine's `isSafeSavedWorkflowName`") therefore needs a real gate in the new
workflow generator, not merely a reuse of `generatedColonName`. Second, this
research obtained the engine's shipped source (`npm pack
@quintinshaw/pi-dynamic-workflows@3.5.1`, the current `latest`) and executed its
real `parseWorkflowScript` against a case table. `DETERMINISM_BLOCKLIST` is the
first of *seven* gates, not the only one — and four of the extractor outcomes
this phase admits are shapes the engine will refuse at run time. That does not
change the locked scope (the CONTEXT decision to replicate only the blocklist
stands, and WNAM-02's stem fallback is a requirement), but it is a measured
residual gap that needs a carrier into Phase 105/WDOC-01 rather than silent
loss. Open Question 1 states it with the full table.

The dependency change is mechanically verified: hand-editing `package.json` and
running `npm install --package-lock-only` produces a two-hunk `package-lock.json`
diff, keeps acorn pinned at the already-resolved 8.16.0, and stays
prettier-clean. Running `npm install acorn` instead (with the package name as an
argument) fetches 8.18.0 and bumps eslint's transitive resolution — a change this
phase has no reason to make.

**Primary recommendation:** Build `domain/workflow-script.ts` around a single
`parse()` call that fills `onComment` and `onToken` arrays; decide in the fixed
order *unparseable -> blocklist -> meta -> name safety*; add
`generatedWorkflowName` to `domain/name.ts` wrapping the unchanged private
`generatedColonName` and adding the two engine-parity assertions; declare acorn
by editing `package.json` by hand and regenerating the lock with a bare
`npm install`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse a workflow script's source text | `domain/` | — | Pure function over a string; `domain/README.md` states the tier is "pure logic with zero I/O", which this satisfies exactly |
| Decide the command name for one script | `domain/` | — | Naming rules already live in `domain/name.ts`; RN-1/RN-2 are domain rules |
| Decide admit-versus-refuse for one script | `domain/` | — | A verdict is a value, not an effect; CONTEXT locks it here |
| Detect same-name collisions within a plugin | `domain/` | — | Operates on an in-memory set the caller assembles; mirrors `assertNoCommandCollisions`, which lives in `bridges/` only because it is called from a stage function |
| Read the workflows directory and enumerate files | `bridges/workflows/` | — | **Phase 103.** This phase reads no directory |
| Route refusal reasons into `warnings[]` | `bridges/workflows/` | `orchestrators/plugin/` | **Phase 103.** This phase produces the verdicts, nothing consumes them yet |
| Declare the parser dependency | build/packaging (`package.json`) | — | Runtime import from `extensions/**` must be a runtime dependency, not a dev one |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `acorn` | `^8.16.0` | Static ES module parsing; `onComment` / `onToken` range collection | The host engine `@quintinshaw/pi-dynamic-workflows@3.5.1` declares `"acorn": "^8.16.0"` as its **only** runtime dependency and uses it for the same job in `parseWorkflowScript` — so our parse and its parse agree by construction `[VERIFIED: npm pack @quintinshaw/pi-dynamic-workflows@3.5.1, package/package.json]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built-in | Test runner | Every test in this repo; no framework install needed |
| `node:assert/strict` | built-in | Assertions | Established across all 1000+ existing assertions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| acorn `onToken` for string-literal ranges | `acorn-walk` recursive visitor | `acorn-walk` is a **fifth** runtime dependency; WDOC-03 explicitly scopes this phase to a fourth. `onToken` needs no walker and no extra package — verified working (Code Examples §2) |
| acorn `onToken` for string-literal ranges | Hand-rolled recursive AST walk | Works, but every node kind must be enumerated to reach nested literals, and `sonarjs/cognitive-complexity: 15` makes a generic walker awkward. `onToken` is one `.filter()` |
| Regex extraction of `meta.name` | — | Rejected by WNAM-01 and proven wrong by spike 026: comment and string decoys silently win, the double-quoted-key form is missed, and a syntax-error file yields a scavenged name |
| Importing the engine's own validators | — | `@quintinshaw/pi-dynamic-workflows` is not installed and will not be; it is a runtime-probed soft dependency (Phase 105). Nothing to import from |

**Installation:**

```bash
# Do NOT run `npm install acorn` -- see Change Map row 2.
# Edit package.json by hand, then:
npm install
```

**Version verification:**

```text
$ npm view acorn version        -> 8.18.0   (latest)
$ npm view acorn time.created   -> 2012-09-24T10:10:49.310Z
$ node_modules/acorn/package.json version -> 8.16.0 (already resolved in this tree)
```

The version to declare is `^8.16.0`, per WDOC-03 and CONTEXT ("the version to
declare is the one already resolved"). The caret admits 8.18.0 for a fresh
install; the committed lockfile keeps this tree at 8.16.0. `[VERIFIED: npm
registry; node_modules/acorn/package.json; package-lock.json:3456-3468]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `acorn` | npm | 13.9 yrs (created 2012-09-24) | 245,149,532/wk | github.com/acornjs/acorn | `SUS` (reason: `too-new`) | **Approved** — see note |

**Packages removed due to `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** `acorn`

**Note on the `SUS` verdict.** `gsd-tools query package-legitimacy check
--ecosystem npm acorn` returned `SUS` with the single reason `too-new`, derived
from `publishedAt: 2026-07-28` — which is `time.modified` (the most recent
release), not the package's age. `npm view acorn time.created` returns
`2012-09-24T10:10:49.310Z`; the package is nearly fourteen years old, has 245M
weekly downloads, a real source repo, is not deprecated, and has no
`postinstall` script. It is not slopsquatted and it was not discovered by
WebSearch: it is (a) already resolved in this repo's `package-lock.json` at
8.16.0 via eslint, and (b) the declared runtime dependency of the host engine
itself, read out of the shipped tarball. The evidence that a
`checkpoint:human-verify` would gather has already been gathered here. If the
plan-checker insists on the literal rule, a checkpoint costs nothing — but it
should be framed as "confirm the version pin", not "confirm the package exists".

`[VERIFIED: npm registry — npm view acorn version/time.created/deprecated;
package-lock.json:3456-3468; @quintinshaw/pi-dynamic-workflows@3.5.1
package/package.json dependencies]`

## Architecture Patterns

### System Architecture Diagram

```text
   caller (Phase 103's bridges/workflows/discover.ts -- NOT built here)
        |
        |  (pluginName, fileName, source)  -- one call per discovered script
        v
+========================================================================+
|                  domain/workflow-script.ts  (NEW, pure)                |
|                                                                        |
|   [1] parse(source, { ecmaVersion:"latest", sourceType:"module",       |
|                       allowReturnOutsideFunction, allowAwaitOutside,   |
|                       onComment: comments[], onToken: tokens[] })      |
|            |                                                           |
|            +-- throws SyntaxError --------> verdict: REFUSED           |
|            |                                (unparseable)      [WNAM-04]
|            v                                                           |
|   [2] DETERMINISM_BLOCKLIST (vendored copy of engine 3.5.1)            |
|       run with a per-call /g regex over the RAW source                 |
|            |                                                           |
|            |   for each match index, classify against                  |
|            |   comments[] ranges U string/template token ranges        |
|            |            |                                              |
|            |            +-- any match in CODE -----> REFUSED           |
|            |            |                            (real violation)  |
|            |            +-- all matches inside ----> REFUSED           |
|            |                comment/string             (misattribution |
|            |                                            remedy) [WVAL-03]
|            v  no match                                                 |
|   [3] meta extraction over the AST already in hand                     |
|         ast.body -> (Export)VariableDeclaration -> declarator `meta`   |
|            |                                                           |
|            +-- no `meta` declarator --------------> SKIPPED   [WNAM-03]|
|            +-- `meta` init not ObjectExpression --> SKIPPED   [CONTEXT]|
|            +-- no `name` prop ---------------------\                   |
|            +-- `name` not a string Literal --------> STEM-FALLBACK     |
|            |                                                  [WNAM-02]|
|            +-- string-literal `name` --------------> NAMED    [WNAM-01]|
|            (also captures `description` for Phase 103's envelope)      |
|            v                                                           |
|   [4] name generation + engine-parity gate                             |
|            |                                                           |
|            v                                                           |
+============|===========================================================+
             |  calls
             v
+========================================================================+
|                     domain/name.ts  (EXTENDED)                         |
|   generatedWorkflowName(plugin, source)                                |
|     -> generatedColonName(plugin, source)   [UNCHANGED, private] WNAM-06|
|          -> assertSafeName x3 (RN-2)                                   |
|     -> assertSafeSavedWorkflowName(generated)  [NEW]                   |
|          length <= 128 && trim()===self  (the two RN-2 gaps)      [SC 4]|
+========================================================================+
             |
             v
      verdict: ADMITTED { generatedName, description? }
             |
             v   (caller assembles the plugin-wide set)
+========================================================================+
|   assertNoWorkflowNameCollisions(verdicts)  -- throws plain Error       |
|   message mirrors bridges/commands/stage.ts:77 assertNoCommandCollisions|
|   runs over the WHOLE set, BEFORE any dedup                     [WNAM-05]
+========================================================================+
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── name.ts               # EXTENDED: generatedWorkflowName + engine gate
│   ├── workflow-script.ts    # NEW: the whole decision layer
│   └── index.ts              # OPTIONAL: barrel re-exports (no importers today)
tests/
└── domain/
    ├── name.test.ts          # EXTENDED: WNAM-06 section
    └── workflow-script.test.ts  # NEW: the case table
```

### Pattern 1: One `parse()`, fixed decision order

**What:** A single `parse()` call fills three things at once — the AST, the
comment ranges, and (via `onToken`) the string/template ranges. The verdict is
then decided in one fixed order.

**When to use:** Every call. The order is not cosmetic:

1. **Unparseable first.** A `SyntaxError` means the comment and token arrays are
   only partially filled (acorn pushes as it scans, then throws), so any
   classification built on them would be unsound. `refused` is the only safe
   answer and WNAM-04 requires it anyway.
2. **Blocklist second.** This is what the engine does first, and it is the gate
   whose message the engine gets wrong. Deciding it before the meta walk means
   a script that is both blocklist-hit and meta-less reports the blocklist
   reason — which is the one the user can act on.
3. **Meta third**, using the AST already in hand.
4. **Name safety last**, because it needs the name the third step produced.

**Note:** the engine itself runs the blocklist *before* parsing, so for a script
that is both unparseable and mentions `Date.now`, the engine reports the
determinism error and we report "unparseable". Ours is the more truthful of the
two and is what WVAL-03 asks for. `[VERIFIED: dist/workflow.js:911-913 read; case
'unparseable + Date.now comment' executed -> engine reports
SCRIPT_VALIDATION_ERROR determinism message]`

### Pattern 2: Wrap, do not widen, the name validator

**What:** `generatedWorkflowName` calls the unchanged private
`generatedColonName`, then applies a *separate* assertion for the two rules the
engine has and `assertSafeName` does not.

**When to use:** Always. Do **not** add the length or trim rules to
`assertSafeName` — it is shared by skills, commands and agents, all of which
have their own pinned tests (`tests/domain/name.test.ts:15-110`) and none of
which want a 128-char cap.

### Pattern 3: Non-global constant, per-call global regex

**What:** Declare the blocklist exactly as the engine declares it — no `g` flag —
so the constant is a byte-identical copy that a future reader can diff against
upstream. Build a global clone per call when match *indices* are needed.

```ts
const g = new RegExp(DETERMINISM_BLOCKLIST.source, "g");
for (const m of source.matchAll(g)) { /* m.index */ }
```

**Why:** a module-level `/…/g` constant carries `lastIndex` across calls and
silently skips matches on the second invocation. `String.prototype.matchAll`
throws `TypeError` on a non-global regex, so the clone is required either way.

### Anti-Patterns to Avoid

- **Regex-extracting `meta.name`.** Forbidden by WNAM-01, disproven by spike
  013's control column: a comment decoy and a string decoy both beat it, the
  double-quoted-key form returns `(none)`, and a syntax-error file returns a
  confidently wrong `oops`.
- **Evaluating the script, or any part of it, to resolve a name.** Untrusted
  third-party code. WNAM-02 says the non-literal value is never evaluated.
- **Widening `assertSafeName` to carry the engine's rules.** See Pattern 2.
- **Adding a `:`-sanitizing step.** Standing policy at
  `bridges/commands/stage.ts:11-12` — "Filenames carry the literal colon (`:`)
  in the basename. POSIX targets allow this; Windows is explicitly not
  targeted." The engine's validator accepts colons: its character class is
  `/[/\\\0]/` and does not include `:`. `[VERIFIED:
  @quintinshaw/pi-dynamic-workflows@3.5.1 dist/workflow-saved.js:7-14]`
- **First-wins dedup before collision detection.** That is exactly what
  `bridges/commands/discover.ts:100-104` does and exactly what CONTEXT
  deliberately diverges from for workflows.
- **On-disk `.js` fixture files.** See Pitfall 4 — three separate repo gates
  reject them.

## Change Map

Every file that must change, the symbol, and what forces the change.

### Production

| # | File | Symbol / line | Change | What forces it |
|---|------|---------------|--------|----------------|
| 1 | `package.json` | `dependencies` block, lines 8-12 | Add `"acorn": "^8.16.0"` as the first key (the block is alphabetized) | **WDOC-03.** Also correctness: acorn is `"dev": true` in the lock today (`package-lock.json:3459`), so a published consumer install would not ship it and the runtime import would fail. `[VERIFIED: package-lock.json:3456-3468]` |
| 2 | `package-lock.json` | `packages[""].dependencies` (~line 11) and `packages["node_modules/acorn"]` (line 3456) | Regenerate. Exactly two hunks: `+ "acorn": "^8.16.0"` in root deps, and `- "dev": true` on the acorn entry | npm. **Method matters:** edit `package.json` by hand then run bare `npm install` (or `npm install --package-lock-only`). Running `npm install acorn` fetches 8.18.0 and bumps eslint's transitive resolution. `[VERIFIED: dry run in a scratch copy — diff is 2 hunks, package count identical, `prettier --check` clean]` |
| 3 | `extensions/pi-claude-marketplace/domain/name.ts` | after `generatedCommandName` (line 86-88) | New exported `generatedWorkflowName(plugin, source): string` calling the existing private `generatedColonName` (line 90) **unchanged** | **WNAM-06.** `@typescript-eslint/explicit-module-boundary-types: "error"` forces the explicit `: string` return type |
| 4 | `extensions/pi-claude-marketplace/domain/name.ts` | same file, new private helper | New engine-parity gate: reject `generated.length > 128` and `generated.trim() !== generated` | **Roadmap SC 4.** `assertSafeName` (line 23-51) enforces neither. See Pitfall 1 for the verbatim engine rule |
| 5 | `extensions/pi-claude-marketplace/domain/workflow-script.ts` | **NEW FILE** | The parse-once module: source parse, blocklist classification, meta extraction, admission verdict, collision assertion | CONTEXT locks the module and its placement. Imports: `acorn` (external group), `./name.ts` (sibling), `../shared/errors.ts` for `assertNever` (line 12) |
| 6 | `extensions/pi-claude-marketplace/domain/index.ts` | lines 20-25 (`name.ts` re-exports) + a new block | **OPTIONAL.** Add `generatedWorkflowName` and the workflow-script types/functions | Nothing compile-forces this — the barrel has **zero importers** (grep across `extensions/` and `tests/` finds only its own header). Consistency only; the file calls itself "public API surface for the domain/ tier" |
| 7 | `extensions/pi-claude-marketplace/domain/README.md` | "Purpose" paragraph, naming-rules sentence | **OPTIONAL.** Add the `<plugin>:<workflow>` shape beside the three existing shapes | Not gated by any test or hook. Note the file is already stale (it still describes "Phase 2/3" planned contents); touching it invites an unrelated cleanup |

### Tests

| # | File | Change | What forces it |
|---|------|--------|----------------|
| 8 | `tests/domain/name.test.ts` | Extend with a WNAM-06 / SC-4 section after the CM-2 block (ends line 143) | New export needs coverage; Phase 101's locked habit is "extend existing files where one fits". Must cover: basic `<plugin>:<name>`, RN-1 prefix elision, the >128 rejection, and the trailing-whitespace rejection |
| 9 | `tests/domain/workflow-script.test.ts` | **NEW FILE.** The nine-case extractor table from spike 026, plus the blocklist classification cases, plus collision, plus admission | Roadmap SC 1/2/3/5. The spike table is the starting set, not the finishing set — see Validation Architecture for the required additions |
| 10 | Fixtures | **Inline template-literal strings inside the `.test.ts` files.** No `.js` fixture files | Three gates reject on-disk `.js` fixtures — see Pitfall 4. Zero `.js` files exist under `tests/` today (`find tests -name '*.js'` -> 0) |

### Explicitly NOT changed

| File | Why not |
|------|---------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | Phase 101 already added `componentPaths.workflows`; this phase consumes nothing from disk (CONTEXT, Integration Points) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | `discoverComponentNames` (line 313-317, already `"workflows"`-widened) still renders file stems. **See Open Question 2** — Phase 101's CONTEXT promised Phase 102 would swap this to `meta.name`, but Phase 102's CONTEXT does not list `info.ts` as an integration point |
| `extensions/pi-claude-marketplace/shared/notify.ts` | No new `REASONS` token this phase (CONTEXT defers to Phase 105) |
| `docs/output-catalog.md` | No new rendered state; the byte-equality gate is untouched |
| `extensions/pi-claude-marketplace/bridges/**` | Hard scope fence: no bridge directory, no ledger, no artifact |
| `docs/competitive-analysis/{zmarketplace,pi-plugins}.md` | Both say "Runtime dependencies … 3: `isomorphic-git`, `proper-lockfile`, `write-file-atomic`" and become stale at 4. Not gated by any test. Listed for awareness; the planner decides whether a one-word doc fix belongs in this phase |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locating `meta.name` in JS source | A regex | `acorn.parse` + AST walk | Spike 026's control column: comment decoy, string decoy, double-quoted key, and syntax-error scavenging all defeat the regex |
| Finding comment ranges | A `//`/`/* */` scanner | acorn's `onComment: Comment[]` | Getting it right means handling strings-containing-`//`, template literals, regex literals, and `<!--`. acorn already did it |
| Finding string-literal ranges | A recursive AST walker, or `acorn-walk` | acorn's `onToken: Token[]` + `tokTypes.string` / `tokTypes.template` | One `.filter()`. No fifth dependency, no cognitive-complexity fight |
| The `<plugin>:<name>` shape and prefix elision | A new joiner | `generatedColonName` (`domain/name.ts:90`) | WNAM-06 mandates it. It already applies `assertSafeName` at all three points and its elision is pinned by four existing tests |
| The collision message format | A fresh message | Mirror `assertNoCommandCollisions` (`bridges/commands/stage.ts:77-101`) | WNAM-05 says "mirroring". The exact shape is `"gen" <- ["a", "b"]` lines joined on `\n  ` after a lead sentence |
| Parsing to split meta from body | Re-deriving the engine's `body` slice | Nothing — out of scope | The engine does `script.slice(0, first.start) + script.slice(first.end)` at run time. WBRG-01's envelope carries the source **verbatim**; we never split it |

**Key insight:** this phase's whole risk is *fidelity to two external contracts*
(the engine's name validator and its determinism blocklist) plus *fidelity to one
internal contract* (`generatedColonName`). Nothing here benefits from
originality. Every hand-rolled substitute listed above is a place where our copy
and the real thing can silently disagree.

## Common Pitfalls

### Pitfall 1: `assertSafeName` does not subsume `isSafeSavedWorkflowName`

**What goes wrong:** The plan reuses `generatedColonName` (which validates via
`assertSafeName`), declares SC 4 satisfied, and ships names the engine will
reject at `save()`/`load()` time.

**Why it happens:** The two validators overlap on four of six rules, so a
side-by-side glance looks like containment. It is not.

The engine's rule, read verbatim from the shipped tarball:

```js
// @quintinshaw/pi-dynamic-workflows@3.5.1 dist/workflow-saved.js:7-14
export function isSafeSavedWorkflowName(name) {
    return (name.length > 0 &&
        name.length <= 128 &&
        name.trim() === name &&
        name !== "." &&
        name !== ".." &&
        !/[/\\\0]/.test(name));
}
```

| Engine rule | `assertSafeName` (`domain/name.ts:23-51`) | Gap |
|-------------|-------------------------------------------|-----|
| `name.length > 0` | `name.trim() === ""` throws — stricter | none |
| `name.length <= 128` | — | **GAP** |
| `name.trim() === name` | only rejects all-whitespace | **GAP** |
| `name !== "."` / `!== ".."` | throws on both | none |
| `!/[/\\\0]/` | rejects `/` and `\` explicitly; NUL via the `code < 0x20` loop | none |

**How to avoid:** Add both rules in the new `generatedWorkflowName` wrapper
(Change Map row 4), never in `assertSafeName`.

**Warning signs:** `meta.name = "audit "` (trailing space) produces
`acme:audit ` — accepted by `assertSafeName`, rejected by the engine. A long
plugin name plus a long `meta.name` crosses 128 with no error on our side.
`[VERIFIED: dist/workflow-saved.js:7-14 read from the 3.5.1 tarball;
domain/name.ts:23-51 read]`

### Pitfall 2: A stale global regex silently skips matches

**What goes wrong:** A module-level `const RE = /…/g` retains `lastIndex`
between calls, so the second script scanned starts mid-source and misses an
early match. Tests pass individually and fail in sequence.

**How to avoid:** Pattern 3 — keep the constant non-global (byte-identical to
the engine's), clone with `"g"` per call.

**Warning signs:** a test that passes alone and fails when a sibling test runs
first. `node --test` runs files concurrently but tests within a file in order.

### Pitfall 3: The comment/string classification needs match *indices*, and the engine's regex only answers *yes/no*

**What goes wrong:** The engine calls `DETERMINISM_BLOCKLIST.test(script)`.
Copying that call gives a boolean, which cannot be classified against comment
ranges. The implementer then reaches for a second, differently-written regex to
find positions — and the two drift.

**How to avoid:** One `source` string, two uses. `DETERMINISM_BLOCKLIST.test()`
answers "would the engine reject this" (the verdict). `new
RegExp(DETERMINISM_BLOCKLIST.source, "g")` + `matchAll` answers "where" (the
message). Same pattern text, no drift.

**Warning signs:** two regex literals in the file.

### Pitfall 4: On-disk `.js` fixtures fail three repo gates

**What goes wrong:** A fixture script is added at
`tests/domain/fixtures/workflows/broken.js` to exercise the `refused` arm. CI
fails in three places at once.

1. `npm run format:check` runs `prettier --check "**/*.{js,json,ts}"`. A
   deliberately unparseable fixture cannot be prettier-clean, and
   `.prettierignore` covers only `.claude/`, `.opencode/`, `.worktrees/`,
   `tmp/`, and one named JSON fixture.
2. `npm run lint` runs `eslint extensions tests eslint.config.js`, and the base
   flat-config block matches `**/*.{js,ts}` with `projectService: true`. A `.js`
   file under `tests/` is not in `tsconfig.json`'s `include`
   (`["extensions/**/*.ts", "tests/**/*.ts"]`), so type-aware linting errors on
   it even before the syntax error does.
3. The `prettier` pre-commit hook matches `files: '\.(js|json|ts)$'` with the
   same result as (1).

**How to avoid:** inline template-literal fixtures inside the `.test.ts` file,
exactly as spike 026's `CASES` table does. `find tests -name "*.js"` returns
**zero** today — the repo has never had one.

**Warning signs:** any new file under `tests/` whose extension is `.js`.

### Pitfall 5: `Property.key` is `Expression`, and `Literal.value` is optional

**What goes wrong:** The spike's JS line
`const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;` does not
compile. acorn types `Property.key` as the full `Expression` union, and
`Literal.value` as `string | boolean | null | number | RegExp | bigint |
undefined`.

**How to avoid:** narrow explicitly, and reject `p.computed` (a computed key is
not statically knowable and the engine rejects it outright with "computed keys
not allowed in meta"). See Code Examples §1 — that skeleton is verified clean
under `tsc --noEmit`, `eslint`, and `prettier --check` in this repo.

**Warning signs:** `tsc` errors on `.name`/`.value` access, or
`@typescript-eslint/prefer-optional-chain` errors on `x === undefined || x ===
null || x.type !== …` guards (this research hit exactly that twice).

### Pitfall 6: `npm install acorn` bumps the tree

**What goes wrong:** The executor runs `npm install acorn`, npm resolves the
`latest` dist-tag (8.18.0), and the diff now includes an eslint-transitive
version bump plus a changed integrity hash — noise in a phase whose dependency
change should be two hunks.

**How to avoid:** edit `package.json` by hand, then bare `npm install`. Verified
to keep 8.16.0 and produce exactly the two intended hunks.

**Warning signs:** `git diff package-lock.json` showing a `version` change on
the acorn entry, or more than two hunks.

## Code Examples

### 1. The typed extractor skeleton (verified in-repo)

This exact code was written to
`extensions/pi-claude-marketplace/domain/__probe.ts`, passed `npx tsc --noEmit`
(0 errors), `npx eslint` (0 errors), and `npx prettier --check` (clean), then
deleted. It is a skeleton, not the finished module — it omits the verdict union
and the blocklist step.

```ts
import { parse, tokTypes } from "acorn";

import type { Comment, Program, Property, Token } from "acorn";

export interface ParsedScript {
  readonly ast: Program;
  readonly comments: readonly Comment[];
  readonly stringRanges: readonly (readonly [number, number])[];
}

export function parseScript(source: string): ParsedScript | undefined {
  const comments: Comment[] = [];
  const tokens: Token[] = [];

  let ast: Program;
  try {
    ast = parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      onComment: comments,
      onToken: tokens,
    });
  } catch {
    return undefined; // WNAM-04: unparseable -> refused, never name-scavenged
  }

  const stringRanges = tokens
    .filter((t) => t.type === tokTypes.string || t.type === tokTypes.template)
    .map((t) => [t.start, t.end] as const);

  return { ast, comments, stringRanges };
}

export function metaPropertyKey(p: Property): string | undefined {
  if (p.computed) {
    return undefined;
  }

  if (p.key.type === "Identifier") {
    return p.key.name;
  }

  if (p.key.type === "Literal" && typeof p.key.value === "string") {
    return p.key.value;
  }

  return undefined;
}

export function findMetaObject(ast: Program): Property[] | undefined {
  for (const node of ast.body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (decl?.type !== "VariableDeclaration") {
      continue;
    }

    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier" || d.id.name !== "meta") {
        continue;
      }

      if (d.init?.type !== "ObjectExpression") {
        return undefined; // CONTEXT: non-object-literal `meta` -> skipped
      }

      return d.init.properties.filter((p): p is Property => p.type === "Property");
    }
  }

  return undefined;
}
```

Notes the plan must carry forward:

- acorn ships `dist/acorn.d.mts` alongside `dist/acorn.d.ts`, so the
  `NodeNext` + `allowImportingTsExtensions` configuration resolves the types
  without a `@types/*` package. Verified: the probe typechecked.
- `findMetaObject` returning `undefined` conflates "no `meta`" with "`meta` is
  not an object literal". CONTEXT collapses both to `skipped`, so that is
  correct here — but the finished module must still keep the four outcomes
  distinct at the union level.
- `import { parse, tokTypes } from "acorn"` sits in the `external` group and
  `import type { … } from "acorn"` in the trailing `type` group, per
  `import-x/order`.

### 2. Comment / string / code classification (verified live)

Run against this repo's acorn 8.16.0 with the engine's exact regex:

```js
const src = [
  "// Header: we avoid Date.now() for resume safety.",
  'export const meta = { name: "drafter", description: "d" };',
  'const help = "mentions Math.random here";',
  "const t = `tpl new Date() inside`;",
  "const real = Date.now();",
  "return 1;",
].join("\n");
```

Observed output:

```text
comments   [ [ 'Line', 0, 49 ] ]
strTokens  [ [ 'string',   78,  87, '"drafter"' ],
             [ 'string',  102, 105, '"d"' ],
             [ 'string',  122, 149, '"mentions Math.random here"' ],
             [ 'template',162, 183, 'tpl new Date() inside' ] ]
match "Date.now"    at 20    -> inside comment  [0,49)
match "Math.random" at 132   -> inside string   [122,149)
match "new Date()"  at 166   -> inside template [162,183)
match "Date.now"    at 199   -> CODE
```

Two mechanics worth pinning in a test: a `string` token range **includes** its
quote characters, while a `template` token range **excludes** its backticks.
Neither affects a containment test on a match index, but an off-by-one
assertion written against the wrong assumption will look like a real bug.
`[VERIFIED: executed in this worktree with node --input-type=module against
node_modules/acorn 8.16.0]`

### 3. The blocklist constant, verbatim from the engine

```ts
/**
 * WVAL-01: byte-identical copy of the private `DETERMINISM_BLOCKLIST` in
 * @quintinshaw/pi-dynamic-workflows 3.5.1 (dist/workflow.js:35). The engine
 * runs it as a raw-text `.test()` over the whole script BEFORE acorn parses,
 * so it cannot tell code from comment -- which is why WVAL-03 classifies the
 * match rather than repeating the engine's message. Re-check on an engine
 * upgrade; there is no exported contract for this value.
 */
const DETERMINISM_BLOCKLIST = /\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/;
```

The engine's own comment above the constant reads: *"Parse-time author hint
(fast feedback). The real enforcement is DETERMINISM_PRELUDE."*
`[VERIFIED: dist/workflow.js:34-35 from the 3.5.1 tarball]`

### 4. The RN-6 message template to mirror

```ts
// bridges/commands/stage.ts:95-100 -- read verbatim
if (collisions.length > 0) {
  throw new Error(
    `Generated command name collision detected. Rename one of the source commands:\n  ` +
      collisions.join("\n  "),
  );
}
// where each entry is: `"${gen}" <- [${sources.map((s) => `"${s}"`).join(", ")}]`
```

The workflow analogue keeps the structure and changes the nouns — and, per
CONTEXT, the "source" identifier for a workflow should be the **file name**,
since the whole point of WNAM-05 is that two different files claimed the same
`meta.name`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Name every bridged artifact from the file stem (`generatedCommandName(plugin, stem)`) | Name workflows from `meta.name`; the stem is the documented fallback | Operator decision 2026-08-14, on spike 026 evidence | `paperjury`'s `<name>.workflow.js` convention makes 3/3 of its commands wrong under stem naming, silently — a dot passes both validators |
| `acorn` present transitively via eslint, `"dev": true` | Declared runtime dependency, the fourth | This phase (WDOC-03) | Without it a published install has no parser at runtime |
| Trust the engine's rejection message | Classify the blocklist match ourselves and report the real reason | This phase (WVAL-03) | The engine's message names a rule the script does not violate |

**Deprecated/outdated:**

- Spike 024's recommendation (legacy path, project-scope only, ship the
  mechanical WFLW-01 fix instead of the bridge) was **not taken** — see its
  "Decision of record (operator, 2026-08-14)". Do not plan against it.
- Spike 024's reuse table claims "no new name generator is needed". That is
  true of the *joining* rule and false of the *validation* rule — see Pitfall 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The verdict function should catch a throw from `assertSafeName`/the engine gate and return a per-file refusal rather than propagating | Open Question 3 | An unsafe `meta.name` in one script hard-fails the whole plugin install, contradicting WVAL-02's spirit; or, if the planner wants the throw, a test asserts the wrong behavior |
| A2 | The admission function should take the file *name* and derive the stem itself (stripping `.js`), rather than receiving a pre-computed stem | Architecture Patterns | Stem derivation splits across Phase 102 and Phase 103, so "the name Claude would give it" is decided in two places |
| A3 | `tests/domain/workflow-script.test.ts` is the right new-file home, with the `name.ts` additions extending `tests/domain/name.test.ts` | Change Map rows 8-9 | Test placement churn; CONTEXT explicitly leaves this to discretion |
| A4 | The `docs/competitive-analysis/*` "3 runtime dependencies" lines are out of scope for this phase | Change Map, "Explicitly NOT changed" | Two docs become quietly stale at 4 dependencies |

## Open Questions

### 1. The blocklist is one of seven engine gates, and four admitted outcomes are shapes the engine refuses

**What we know (measured, not inferred).** This research obtained
`@quintinshaw/pi-dynamic-workflows@3.5.1` via `npm pack` (3.5.1 is the current
`latest`), extracted `parseWorkflowScript` into a standalone harness with a stub
`WorkflowError`, and executed it against a case table. Results:

| Script shape | Engine verdict | Our Phase-102 verdict (per locked decisions) |
|---|---|---|
| `export const meta = { name: "a", description: "d" }` first | **OK** | `named` — agrees |
| 20-line header comment, then the export | **OK** | `named` — agrees |
| double-quoted key `{"name": "a", "description": "d"}` | **OK** | `named` — agrees |
| comment mentions `Date.now` | REJECT (determinism, misattributed) | refused — agrees, with the better message |
| string literal mentions `Math.random` | REJECT (determinism, misattributed) | refused — agrees |
| unparseable | REJECT (SyntaxError) | `refused` — agrees |
| `meta` present but **no `description`** | **REJECT** — "meta.description must be a non-empty string" | `named` → **admitted** |
| `meta` **not the first statement** | **REJECT** — "must be the first statement in the script" | `named` → **admitted** |
| `export let meta = {…}` | **REJECT** — "meta export must be `export const meta = ...`" | `named` → **admitted** |
| bare `const meta = {…}` (not exported) | **REJECT** — first-statement rule | `named` → **admitted** |
| `export const meta = {…}, other = 1` | **REJECT** — "meta export must declare only `meta`" | `named` → **admitted** |
| `meta` with no `name` property | **REJECT** — "meta.name must be a non-empty string" | `stem-fallback` → **admitted** (WNAM-02) |
| `name: someVar` (non-literal) | **REJECT** — "non-literal node type in meta.name: Identifier" | `stem-fallback` → **admitted** (WNAM-02) |
| `name: \`a\`` (template literal, no interpolation) | **OK** — the engine's `evaluateLiteral` handles it | `stem-fallback` → admitted under a *different* name than the engine's `meta.name` |

**What's unclear:** nothing factual — the measurement is unambiguous. What is
open is *where this lands*.

**Why it does not reopen the locked decision.** CONTEXT's stated rationale for
replicating only the blocklist ("the remainder of that function is acorn parsing
the extractor already performs") turns out to be incomplete — the remainder also
carries five structural rules the extractor does not check. But the *decision*
still holds on its own stronger ground: these are unexported internals of a 0.x
package with 50 releases since May 2026, and replicating them means our install
refuses scripts for reasons an engine upgrade may drop. WVAL-01 asks for
pre-validation "against the engine's own text-level preprocessor" — the
blocklist is the text-level preprocessor, and that is what this phase delivers.
WNAM-02's stem fallback is a requirement, not a choice.

**Recommendation:** leave Phase 102's scope exactly as locked, and carry this
table forward as an explicit deliverable of **WDOC-01 in Phase 105** ("state
which script semantics are guaranteed versus divergent from Claude"). The
failure mode it produces is bounded and visible: the artifact installs, the
command registers, and the engine reports `/<name> failed: <message>` at
invocation (`dist/saved-commands.js:105-107`) — it is not silent corruption. The
planner should add one line to the Phase 105 CONTEXT or todos so this does not
evaporate between phases.

**Secondary note for Phase 103:** `parseWorkflowScript` is called only from
`runWorkflow` and `WorkflowManager.startInBackground`/`createManaged` — i.e. at
*invocation*, never at save or at `registerAllSavedWorkflows` time. So a script
we admit always registers as a command regardless. `[VERIFIED: grep over
dist/*.js; dist/saved-commands.js:66-107 read]`

### 2. Who swaps the `info` line from file stem to `meta.name`?

**What we know:** Phase 101's CONTEXT states plainly: *"The line shows the file
stem in this phase. Phase 102 swaps the name source to the extracted
`meta.name`. This phase owns the plumbing; Phase 102 owns the name."*
`orchestrators/plugin/info.ts::discoverComponentNames` (line 313) today accepts
`"workflows"` and returns stems.

**What's unclear:** Phase 102's CONTEXT lists exactly three integration points —
`domain/workflow-script.ts`, `domain/name.ts`, `package.json` — and the hard
scope fence says this phase reads no directory. Swapping the `info` line means
reading each `.js` file's source from an orchestrator, which is squarely outside
that fence. The Phase 102 roadmap success criteria do not mention `info`, and
the deferred list does not carry it either.

**Recommendation:** the Phase 102 CONTEXT is authoritative and this is **not** in
Phase 102. Record it as a forward dependency on **Phase 103**, which builds the
discover path that already reads the sources — feeding the same verdicts to
`info.ts` there costs one call and no new I/O. The planner must write this into
the phase's forward-dependency list explicitly; a promise made in Phase 101's
CONTEXT and absent from both 102 and 103 is exactly the shape of a deferral that
ships un-fixed.

### 3. Is an unsafe `meta.name` a per-file skip or a plugin-wide throw?

**What we know:** `generatedColonName` throws a plain `Error` from
`assertSafeName` when the plugin name, the elided source, or the joined form is
unsafe (`domain/name.ts:90-103`). A `meta.name` of `"a/b"` or `"."` reaches that
throw. The new >128 / untrimmed gate (Pitfall 1) adds two more throw sites.

**What's unclear:** CONTEXT locks the *collision* as a throw and the
*unparseable* case as a per-file skip, but says nothing about an
individually-unsafe name.

**Recommendation:** per-file refusal, not a throw. The reasoning is WVAL-02's
stated principle — "one broken file in a twenty-script plugin must not block the
other nineteen" — and the Core Value's "degradation never blocks the install".
The collision is different in kind: it is a defect of the *set*, not of one
file, and refusing one arbitrary member would be the silent misnaming WNAM-05
exists to prevent. The plan should state this explicitly so the executor does
not let the `assertSafeName` throw escape the verdict function by accident.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v22.22.2 (engines floor `>=20.19.0`) | — |
| `acorn` | the extractor | ✓ | 8.16.0, resolved in `node_modules` (dev-only in the lock today) | — |
| npm registry (for `npm install`) | WDOC-03 lockfile regeneration | ✓ | reachable — `npm view` and `npm pack` both succeeded | — |
| `@quintinshaw/pi-dynamic-workflows` | nothing in this phase | ✗ (not installed, and will not be) | — | Vendored constant + our own name assertion, per CONTEXT |
| `tsc` / `eslint` / `prettier` | `npm run check` | ✓ | per `devDependencies` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the host engine — by design; it is a
runtime-probed soft dependency landing in Phase 105.

**Worktree note:** `node_modules` in this worktree is a **symlink** to the
primary checkout's tree. Any `npm install` run here mutates the primary
checkout's `node_modules`. Because the intended change is `--package-lock-only`
in effect (acorn is already installed at the right version), this is benign —
but the executor should prefer `npm install --package-lock-only` and must not
`rm -rf node_modules`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in, v22.22.2) + `node:assert/strict` |
| Config file | none — globs live in `package.json` `scripts` |
| Quick run command | `node --test tests/domain/workflow-script.test.ts` |
| Full suite command | `npm test` (unit) — `npm run check` for the phase gate |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WNAM-01 | String-literal `meta.name` yields `<plugin>:<meta.name>` — including `meta` at line 26 behind a header, a double-quoted key, and a `<something>.workflow.js` file name | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ Wave 0 |
| WNAM-01 | Comment decoy and string decoy do **not** win | unit | same | ❌ Wave 0 |
| WNAM-02 | `meta` with no `name` -> `stem-fallback`, value never read | unit | same | ❌ Wave 0 |
| WNAM-02 | `name: someVar` -> `stem-fallback`, value never evaluated | unit | same | ❌ Wave 0 |
| WNAM-03 | no `meta` declaration -> `skipped`, not installed | unit | same | ❌ Wave 0 |
| WNAM-03 | `meta` present but not an object literal -> `skipped` (CONTEXT extension) | unit | same | ❌ Wave 0 |
| WNAM-04 | acorn `SyntaxError` -> `refused`, no scavenged name | unit | same | ❌ Wave 0 |
| WNAM-04 | unparseable **and** blocklist-hit -> `refused` (ordering pin) | unit | same | ❌ Wave 0 |
| WNAM-05 | two files, same resolved name -> throws; message names both file names | unit | same | ❌ Wave 0 |
| WNAM-05 | collision detected over the whole set, **before** any dedup | unit | same | ❌ Wave 0 |
| WNAM-06 | `<plugin>:<name>` shape, and RN-1 `<plugin>-` prefix elision | unit | `node --test tests/domain/name.test.ts` | ✅ (file exists; new section) |
| WNAM-06 / SC 4 | generated name > 128 chars is rejected | unit | same | ❌ Wave 0 |
| WNAM-06 / SC 4 | generated name with trailing whitespace is rejected | unit | same | ❌ Wave 0 |
| WNAM-06 | a colon-bearing generated name is **accepted** (no sanitizing step) | unit | same | ❌ Wave 0 |
| WVAL-01 | blocklist-hit script is not admitted, decided from source alone | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ Wave 0 |
| WVAL-02 | one refused script among several leaves the others admitted | unit | same | ❌ Wave 0 |
| WVAL-03 | code match and comment-only match report **distinct** reasons | unit | same | ❌ Wave 0 |
| WVAL-03 | string-literal-only match classified as such, not as a code violation | unit | same | ❌ Wave 0 |
| WVAL-03 | template-literal match classified (backtick-exclusive range) | unit | same | ❌ Wave 0 |
| WDOC-03 | `acorn` present in `package.json` `dependencies`; lock entry has no `"dev": true` | unit (architecture-style, reads `package.json`) | `node --test tests/architecture/…` or a case inside the workflow-script suite | ❌ Wave 0 (optional — see note) |
| WDOC-03 | the extension imports acorn and typechecks | typecheck | `npm run typecheck` | ✅ |

**Note on the WDOC-03 test.** A dependency declaration is normally proven by
`npm run check` passing, not by an assertion. A small pin is still cheap and
mirrors `tests/architecture/no-telemetry-deps.test.ts`, which already reads
`package.json` for exactly this class of claim. The planner should decide;
if included, assert *membership*, not the exact version string, so a future
caret bump does not fail the gate.

### Sampling Rate

- **Per task commit:** `node --test tests/domain/workflow-script.test.ts tests/domain/name.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green (typecheck + lint + format:check + unit + integration) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/domain/workflow-script.test.ts` — covers WNAM-01..05, WVAL-01..03
- [ ] `tests/domain/name.test.ts` new WNAM-06 / SC-4 section — file exists, section does not
- [ ] Inline fixture corpus inside the test file: the nine spike-013 cases plus
      the divergent-plugin case (`drafter.workflow.js` shape: 20-line header,
      `meta` at line 26, stem `drafter.workflow`, `meta.name` `drafter`)
- [ ] No framework install needed — `node:test` is built in

## Security Domain

This phase's security posture is unusual in one specific way: it is the analysis
layer that decides whether untrusted third-party JavaScript is admitted for
later installation. It executes nothing.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no identity surface in this phase |
| V3 Session Management | no | no session surface |
| V4 Access Control | no | no authorization decision |
| V5 Input Validation | **yes** | The whole phase. Untrusted plugin-authored JS is parsed **statically** with acorn; no `eval`, no `new Function`, no `vm`, no `import()`. Names are validated by `assertSafeName` (RN-2, path-traversal and control-character screening) plus the new engine-parity gate |
| V6 Cryptography | no | no crypto in this phase |
| V12 File Handling | **partially** | No file is read or written here, but the generated name becomes a filename basename in Phase 103 — which is precisely why RN-2's `/`, `\`, `.`, `..` screening must not be bypassed |
| V14 Configuration | **yes** | A new runtime dependency enters the supply chain. Audited above; no `postinstall` script |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Metadata extraction by executing untrusted code | Elevation of Privilege | Static AST parse only — mandated by WNAM-01 and enforced by the absence of any `eval`/`Function`/`vm` import. `tests/architecture/no-shell-out.test.ts` already bans `child_process` extension-wide |
| Path traversal via a crafted `meta.name` (e.g. `"../../evil"`) | Tampering | `assertSafeName` rejects `/` and `\` before the name ever reaches a path join; the engine's own validator agrees |
| Filename control characters / NUL injection via `meta.name` | Tampering | `assertSafeName`'s `code < 0x20 \|\| code === 0x7f` loop; the engine screens `\0` explicitly |
| Denial of service via a pathological script (deeply nested, enormous) | Denial of Service | acorn is a single-pass parser with no backtracking; the regex is linear-ish and anchored on `\b` word boundaries with no nested quantifier — no ReDoS shape. Residual risk is bounded by file size, which Phase 103's discover step governs |
| Supply-chain compromise of the new parser | Tampering | `acorn` audited above: 14 years old, 245M weekly downloads, no `postinstall`, pinned by integrity hash in `package-lock.json` |
| Name collision used to shadow another plugin's command | Spoofing | Out of this phase's reach — collisions are detected **within** one plugin (WNAM-05). Cross-plugin shadowing is governed by the `<plugin>:` prefix, which `generatedColonName` always emits |

## Sources

### Primary (HIGH confidence)

- `@quintinshaw/pi-dynamic-workflows@3.5.1` shipped tarball, obtained via
  `npm pack` this session — `dist/workflow-saved.js` (`isSafeSavedWorkflowName`,
  `createWorkflowStorage`), `dist/workflow.js` (`DETERMINISM_BLOCKLIST`,
  `parseWorkflowScript`, `evaluateLiteral`, `validateMeta`),
  `dist/saved-commands.js` (registration + failure UX), `package.json`
  (`"acorn": "^8.16.0"` as sole runtime dependency)
- Live execution of the engine's real `parseWorkflowScript` against a 19-case
  table (this session), producing the Open Question 1 divergence table
- `node_modules/acorn/dist/acorn.d.ts` — `Options.onComment`, `Options.onToken`,
  `tokTypes`, `Program`/`Property`/`Literal`/`VariableDeclarator` interfaces
- Live in-repo verification: the extractor skeleton passing `tsc --noEmit`,
  `eslint`, and `prettier --check`; the acorn classification run; the
  `package-lock.json` dry-run diff
- Repo source read this session: `domain/name.ts`, `domain/index.ts`,
  `domain/README.md`, `bridges/commands/stage.ts`, `bridges/commands/discover.ts`,
  `orchestrators/plugin/info.ts` (lines 295-360, 675-705), `package.json`,
  `package-lock.json`, `tsconfig.json`, `eslint.config.js`,
  `.pre-commit-config.yaml`, `.prettierignore`,
  `tests/domain/name.test.ts`, `tests/architecture/no-telemetry-deps.test.ts`,
  `tests/architecture/import-boundaries.test.ts`
- npm registry: `npm view acorn version time.created time.modified deprecated`;
  `npm view @quintinshaw/pi-dynamic-workflows version dist-tags`
- `gsd-tools query package-legitimacy check --ecosystem npm acorn`

### Secondary (MEDIUM confidence)

- `.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md`
- `sources/026-meta-name-extraction/{extract.mjs,README.md}` — the prototype and
  its nine-case result table
- `sources/022-a-script-trust-boundary-quintinshaw/README.md` — the measured
  sandbox table and the comment-vs-code defect
- `sources/024-workflows-bridge-shape/{name-interop.mjs,README.md}` — the reuse
  claim and the operator's decision of record
- `sources/023-landing-zone-quintinshaw/README.md` — the envelope shape, the
  `isSafeSavedWorkflowName` rule summary (independently re-verified from source
  this session), and the colon/NTFS note
- `sources/021-workflow-demand-signal/README.md` — the naming-convention
  evidence (`agentops` 3/3 match, `paperjury` 3/3 diverge)

### Tertiary (LOW confidence)

- None. Every claim in this document traces to source read or code executed this
  session, or to a spike artifact that itself records a measurement.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — one dependency, already in the tree, read out of
  the host engine's own manifest, and its lockfile change dry-run verified
- Architecture: **HIGH** — the module boundary is locked by CONTEXT, and the
  skeleton was compiled and linted in this repo rather than sketched
- Pitfalls: **HIGH** — Pitfall 1 read from both validators' source; Pitfall 4
  read from three config files and confirmed by `find tests -name "*.js"` -> 0;
  Pitfall 5 hit and fixed live; Pitfall 6 dry-run verified
- Engine-parity divergence (Open Question 1): **HIGH** — the engine's real
  function was executed, not read
- Cross-phase carrier questions (Open Questions 2-3): **MEDIUM** — the facts are
  certain; the routing is a planning judgment the planner or the operator owns

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days). Re-verify sooner if
`@quintinshaw/pi-dynamic-workflows` publishes past 3.5.1 — `isSafeSavedWorkflowName`
and `DETERMINISM_BLOCKLIST` are unexported internals of a 0.x-stability package
with no compatibility contract.
