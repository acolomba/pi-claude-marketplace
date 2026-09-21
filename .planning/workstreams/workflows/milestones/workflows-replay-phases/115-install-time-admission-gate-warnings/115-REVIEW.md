---
phase: 115-install-time-admission-gate-warnings
reviewed: 2026-09-09T07:35:31Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - docs/output-catalog.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/domain/workflow-script.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/workflows-doc-pins.test.ts
  - tests/architecture/workflows-single-parse.test.ts
  - tests/bridges/workflows/discover.test.ts
  - tests/domain/workflow-script.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
---

# Phase 115: Code Review Report

**Reviewed:** 2026-09-09T07:35:31Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The phase's stated absolute -- no gate reading can ever block anything -- holds. I traced it and probed it:

- **`readEngineGate` cannot throw past its `catch`** (`domain/workflow-script.ts:841-849`). Everything inside the `try` is synchronous: `gateContext` reads `ast.body[0]` and cannot throw, `GATE_ORDER.find` short-circuits on the first true predicate, and the only throw site under it is the depth budget. I drove 19 hostile `meta` shapes (class/function/arrow/await/tagged-template values, 200- and 3000-deep object and array nesting, a 200,000-element array, `__proto__`, BigInt and float keys, double-unary, spread before and after `name`, an accessor `name`, hashbang) through `admitWorkflowScript` and nothing escaped. `enable`, `install`, `reinstall`, `update` and `info` are all unaffected.
- **The depth budget of 32 is safe and fails in the harmless direction.** A real `meta` reaches nesting level 2 (`meta.phases[0].title`); the budget throws only at 33. Exceeding it returns `undefined`, i.e. a missed warning, and the verdict, generated name and record are byte-identical to the ungated run -- confirmed by probe (200-deep array admits `named` with no `gate` key) and by the repo's own budget case.
- **`GATE_ORDER.find` guarantees first-failure-wins** -- `Array.prototype.find` iterates in index order -- and the six predicates match the engine order 3, 4, 5, 6, 8, 9 that `docs/workflows-compatibility.md` and `tests/architecture/workflows-doc-pins.test.ts` pin.
- **The `install.ts` / `reinstall.ts` reclassification does not move the plugin row.** `WGATE-03 / D-115-06` compares the whole `NotifyRecord` byte-for-byte with both non-vacuity anchors present. Confirmed by reading `collectPostCommitWarnings` and `runLockedReinstall`: the only behavioral deltas are (a) which channel the strings ride and (b) their ORDER inside `postCommitWarnings` in orchestrated mode, where the workflows lines now lead instead of trail.
- **`WorkflowOutcomeSite`'s sixth member is wired everywhere it is switched on.** The only two consumers are `INSTALL_OUTCOMES` and `PREVIEW_OUTCOMES`, both annotated `Record<WorkflowOutcomeSite, string>`; `readFailureWarning` narrows with `Extract<..., "read" | "inspect">`. No arm defaults.

The counted-set audit is clean on the TypeScript side: `GATE_ORDER` (6) / `GATE_PREDICATES` (6) / `GATE_REASONS` (6) are compiler-locked to each other, `WorkflowOutcomeSite` (6) locks both tense tables, `SkippedCause` (4) locks `SKIPPED_REASONS`, and the doc's `nine` / `six` / `[1,2] / [3,4,5,6,8,9] / [7]` partitions are gated asymmetrically across markdown and TypeScript. The three architecture test files are, on the whole, unusually careful; the `readEngineGate` prefix-match defect named in the brief is genuinely fixed and the sibling `GATE_ORDER_DECLARATION` and `GATE_NAME_CELL` patterns are anchored the same way.

What did not hold up: a **provable output-forgery hole** the phase widens (CR-01, demonstrated), a **user-facing header that now states the opposite of the line beneath it** (WR-01, acknowledged as Broken Windows #36 but shipped and asserted-as-is), a **field comment the phase's own change falsified** (WR-02), and two **enumerations shorter than the sets they name** -- one in the compatibility doc (WR-03) and one in the user-facing gate sentence itself (WR-04), which is exactly the failure mode this milestone has shipped eight times.

## Critical Issues

### CR-01: A plugin-supplied file name forges extra lines in the user-facing warning block

**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:98-105` (call sites `:333`, `:340`, `:441`, `:462`)

**Issue:** `softFailWarning` interpolates the plugin-controlled file name and directory into the message with no escaping:

```ts
return `workflow script "${fileName}" in "${workflowsDir}" ${outcome}: ${reason}`;
```

`fileName` is `entry.name` / `verdict.fileName`, read straight off a third-party plugin tree. The decision layer goes to considerable length to defend against exactly this -- `forMessage` (`domain/workflow-script.ts:1113-1118`) escapes `\p{Cc}`/`\p{Cf}` and its doc comment states the threat in terms: *"A POSIX file name may contain a newline, so a plugin can forge what looks like an extra output line inside a refusal block."* The bridge then re-introduces the raw name on the same line, one layer up, so the mitigation is defeated for the prefix while it holds for the `reason` tail.

The lines are rendered by `notifyDiagnostic` as `${header}\n\n${lines.join("\n")}` (`shared/notify.ts:448`), so a forged line is byte-indistinguishable from a real one. Verified by running the real bridge against a plugin whose script is named `ok.js"\nworkflow script "forged.js" ... \n.js`:

```text
Plugin "hello" installed; 1 declared component was skipped.

workflow script "ok.js"
workflow script "forged.js" in "workflows" was installed but the engine will refuse to load it: nothing
.js" in "/tmp/probe-uG4V27/workflows" was installed ...
```

The middle line is entirely attacker-authored. `redactAbsolutePaths` does not neutralize it (it only basenames path-shaped runs), and `\p{Cf}` bidi overrides pass through the same way.

This class pre-existed in `softFailWarning`, but this phase materially widens it: (a) `named` verdicts now earn a line at all (`verdictWarning:336-340`), so a well-formed script with a hostile file name reaches the channel where before it did not, and (b) the whole array moved from `bridgeWarnings` (orchestrated-only) to `discoveryWarnings`, which install and reinstall now render to **standalone** users (`install.ts:1236`, `reinstall.ts:1074`).

**Fix:** escape at the point untrusted text enters the string, the same rule the domain layer states. Export `forMessage` (or a bridge-local twin) and apply it to both interpolations:

```ts
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  // The file name and the directory are plugin-controlled: a POSIX name may
  // carry a newline or a bidi override, and this line is rendered into a
  // block whose lines are joined on "\n". The reason arrives already escaped
  // by the decision layer; these two must be escaped here for the same reason.
  return `workflow script "${forMessage(fileName)}" in "${forMessage(workflowsDir)}" ${outcome}: ${reason}`;
}
```

Then pin it: a bridge case feeding a file named `"ok.js\nforged\n.js"` and comparing the whole warning array, mirroring `WGATE-04: keeps the whole escaped refusal reason for a file name carrying a newline` in `tests/domain/workflow-script.test.ts`, which already proves the domain half.

## Warnings

### WR-01: The discovery-warning header now contradicts the two admitted lines beneath it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1236`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1074` (header at `orchestrators/plugin/shared.ts:1451-1455`)

**Issue:** `surfaceDiscoveryWarnings` heads its block with `Plugin "X" installed; N declared components were skipped.` Two of the six families now routed into that array were **not** skipped: `gate` ("was installed but the engine will refuse to load it") and `stem-fallback` ("was installed but will not run"). Both write an envelope and register a command. The phase's own design forbids exactly this shape -- `discover.ts:247-251` says the outcome phrase "states an ADMITTED fact before its caveat... a phrase shaped like the three soft-fails would report a refusal that did not happen" -- and the header then does it anyway, one line above.

Concrete: `tests/orchestrators/plugin/install.test.ts:10919` and `tests/orchestrators/plugin/reinstall.test.ts:5009` both assert `5 declared components were skipped` over a list in which two lines say the script was installed. Both tests carry a comment conceding the sentence is false.

Recorded as Broken Windows #36 (`.planning/WINDOWS.md`, status `open`), so this is not news -- but it ships as user-visible output that contradicts itself, and it is newly reachable only because of D-115-05.

**Fix:** make the header count what it can honestly count, or state a neutral subject. The cheapest truthful form keeps one sentence and drops the disposal claim:

```ts
const header =
  lines.length === 1
    ? `Plugin "${args.plugin}" ${args.verb}; 1 note about a declared component.`
    : `Plugin "${args.plugin}" ${args.verb}; ${lines.length.toString()} notes about declared components.`;
```

This is shared by install, update and reinstall, so the fix moves three catalog/test expectations together; that is the cost of the shared sentence, not a reason to defer.

### WR-02: `InstallCtx.discoveryWarnings`' own doc is falsified by this phase's change

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:381-387`

**Issue:** the field comment reads:

```ts
// D-07 discovery warnings from the skills, commands and agents bridges: an
// artifact the plugin author shipped that this install did NOT materialize
// (a duplicate generated name, an unreadable subdirectory, a source path
// that produces no valid name). ...
discoveryWarnings: string[];
```

Three things are now wrong on the line beside the code:

1. It names the **agents** bridge. Agents feed `bridgeWarnings` (`install.ts:1072`, with its own comment explaining why), and the phase's amended `collectPostCommitWarnings` doc at `install.ts:1662-1664` says so explicitly: *"The skills, commands and workflows bridges feed that array; the agents bridge... rides the hygiene channel instead."* The two comments in one file now contradict each other.
2. It omits **workflows**, which this phase made a feeder at `install.ts:1236`.
3. Its stated contract -- *"an artifact the plugin author shipped that this install did NOT materialize"* -- is false for the `gate` family, which describes an artifact that WAS materialized. That mis-stated contract is the same root cause as WR-01.

The phase updated the consumer's doc and left the producer's doc stale, which is precisely the "comment that survives the change it describes" the project comment policy bars.

**Fix:**

```ts
// D-141-03 / WGATE-01: discovery warnings from the skills, commands and
// workflows bridges. Each names one declared component and what became of
// it -- not materialized (a duplicate generated name, an unreadable
// subdirectory, a source path that produces no valid name), or materialized
// with a caveat (a workflow script the host engine will refuse to load).
// Kept apart from `bridgeWarnings` because D-19-01 as amended surfaces these
// in standalone mode while the hygiene warnings beside them stay suppressed.
discoveryWarnings: string[];
```

### WR-03: The compatibility doc's check-8 note claims a skip the bridge does not perform

**File:** `docs/workflows-compatibility.md:86`

**Issue:** the classification table's check-8 note states: *"A spread or a computed key at the top level of `meta` is a per-file skip instead."* That is true only when the spread or computed key follows the last literal `name`. `readMetaString` is last-wins by design (`domain/workflow-script.ts:763-787`, and its own doc says *"A spread BEFORE the last literal occurrence is harmless"*), so a spread that PRECEDES the name leaves the script `named` and warned at gate 8 -- not skipped.

The repo proves it against itself. Probe:

```text
spread-before-name => {"outcome":"named","gate":"meta-not-pure-literal"}
spread-after-name  => {"outcome":"skipped","cause":"meta-spread"}
```

and `hostileMetaScript` in `tests/orchestrators/plugin/install.test.ts:10717-10728` opens with `...extra,` at the top level of `meta` and asserts the plugin installs with one gate line.

Notably the same document's "Install-time disposition" bullet (`:228`) gets it right -- *"a spread or a computed key that could supply or overwrite `name`"* -- so the two sections of one document disagree. Nothing gates the note text.

**Fix:** align row 86's note with the disposition bullet:

```markdown
A spread or a computed key that could supply or overwrite `name` -- that is,
one standing AFTER the last literal `name` -- is a per-file skip instead; one
standing before it is admitted and warned here, because last-wins means the
literal overwrites whatever the spread contributed.
```

### WR-04: The check-8 gate sentence enumerates eight forbidden forms and omits the ninth the code deliberately implements

**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:171-172`

**Issue:** the user-facing sentence is:

> the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), array hole, substituted template or computed expression

`isLiteralProperty` (`domain/workflow-script.ts:950-967`) refuses one more shape than that list names: a **key node the engine's `propertyKey` cannot read**, i.e. a BigInt-literal key. That is not "a computed key" and not any of the other seven. The implementation treats it as important enough to justify a dedicated eight-line comment (`:943-949`, *"would decide ten of the engine's eleven refusals and read the eleventh backwards"*) and a dedicated test row (`tests/domain/workflow-script.test.ts`, `declares a BigInt-literal key in meta`). Confirmed by probe: `{ 1n: "x" }` yields `gate: "meta-not-pure-literal"`.

So the one author who trips the case the code went out of its way to cover receives a sentence listing eight other things and not theirs. This is failure mode #1 -- an enumeration shorter than the set it names -- landing directly in shipped output.

**Fix:** add the missing member to the sentence (and to the same list in `docs/workflows-compatibility.md:172`'s mirror if it is restated there):

```ts
"meta-not-pure-literal":
  "the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), key written as anything but an identifier, string or number, array hole, substituted template or computed expression",
```

### WR-05: A "one line per file" assertion that passes for zero lines

**File:** `tests/orchestrators/plugin/install.test.ts:10745`

**Issue:**

```ts
assert.deepStrictEqual(diagnostic.split("\n\n").slice(1).join("\n\n").split("\n").length, 1);
```

If `diagnostic` contains no `\n\n`, `slice(1)` is `[]`, the join is `""`, and `"".split("\n").length` is `1` -- the assertion passes having inspected nothing. The whole point of the case (`T-115-03`: "one line for the file, never a list of every failing shape") is unchecked in that state. The only thing standing between it and vacuity is the `notifications.length === 2` assertion two lines up, which does not constrain the block's internal shape at all: a change to `notifyDiagnostic`'s separator, or a header-less block, greens this case over an arbitrary number of lines.

Every sibling case in this phase compares whole arrays or whole messages; this one is the outlier.

**Fix:** compare the lines themselves, not their count:

```ts
const [header, ...blocks] = diagnostic.split("\n\n");
assert.ok(header !== undefined && header.length > 0);
assert.deepStrictEqual(
  blocks.join("\n\n").split("\n"),
  [
    `workflow script "greet.js" in "workflows" was installed but the engine will refuse to load it: ${CHECK_8_REASON}`,
  ],
);
```

### WR-06: Two "eleven" counts with no enumeration and no gate

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:929-930`, `:947`

**Issue:** the `isLiteralObject` and `isLiteralProperty` docs assert *"The refusal side is eleven separate throws"* and *"would decide ten of the engine's eleven refusals and read the eleventh backwards."* Nothing in this repository enumerates eleven of anything. `GATE_REASONS`' own sentence names eight forms; the code's predicate arms number differently again; the compatibility document -- which is exactly the artifact these comments describe -- states the rule that forbids this: *"This document states no total count of the engine's refusal messages, and none should be added... any total would be a number with no honest counting rule behind it"* (`docs/workflows-compatibility.md:102`).

An unenumerated, ungated count of an unexported engine internal is the shape that has shipped wrong eight times in this milestone. It also gives the second sentence its whole rhetorical force ("ten of eleven"), so a reader takes it as measured.

**Fix:** drop the arithmetic and keep the argument, which does not need it:

```
 * An ALLOW-list, stated in the engine's own terms. The refusal side is a long
 * list of separate throws, and a deny-list of that shape is the enumeration a
 * reader like this gets wrong; naming the forms that ARE resolvable makes an
 * unforeseen node type fire the gate rather than slip past it.
```

and, at `:947`, `"would decide most of the engine's refusals and read the key-node one backwards."`

## Info

### IN-01: Two different line ranges cited for the same nine checks

**File:** `docs/workflows-compatibility.md:52` vs `extensions/pi-claude-marketplace/domain/workflow-script.ts:46`

**Issue:** the doc pins the nine checks to `src/workflow.ts:1504-1564`; the `GATE_ORDER` comment pins checks 3-9 of the same path to `src/workflow.ts:1504-1626`. Both are unverifiable from this repo (the engine is not vendored) and neither is gated, so the pair can only be reconciled by re-reading 3.10.1.

**Fix:** state one range in one place and have the other cite it (`see docs/workflows-compatibility.md's classification table`), so `WPIN-01` has a single thing to re-read.

### IN-02: A shipped document cites a planning artifact readers cannot open

**File:** `docs/workflows-compatibility.md:7`, `:12`, `:71`, `:125`

**Issue:** four references to "Spike 027" as the evidence base for the document's runtime-measured claims. `Spike 027` exists only at `.planning/spikes/027-workflow-engine-3-10-1-recheck/`, which is a planning artifact -- archived on milestone close and not part of what a reader of the published README-linked doc has. The document's own evidence-grading discipline is otherwise scrupulous; this is the one citation that cannot be followed.

**Fix:** either inline the measurement (what was probed, what was observed) or name it as an internal record: `an internal re-measurement against 3.10.1 on <date>`.

### IN-03: A doc-pins failure that reports the wrong cause

**File:** `tests/architecture/workflows-doc-pins.test.ts:167-169`

**Issue:** `doc.indexOf("**six distinct messages**")` returns `-1` when the phrase is removed, so `doc.slice(-1)` takes the document's last character, `split("\n\n")[1]` is `undefined`, and the case fails at `messageBullets.length === 6` claiming *"validateMeta message list no longer holds exactly six bullets"* when the real cause is a deleted heading sentence. The `assert.match(doc, /\*\*six distinct messages\*\*/)` that would name it truthfully runs afterwards.

**Fix:** assert the anchor before slicing on it:

```ts
const listStart = doc.indexOf("**six distinct messages**");
assert.notEqual(listStart, -1, `${COMPAT_DOC} no longer states the validateMeta message count.`);
```

### IN-04: `install.ts`'s module header still says standalone emits one notification

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:43-46`, `:200-208`, `:2540-2542`

**Issue:** three places still state that standalone mode fires "a SINGLE `notify(...)` call per orchestration arm" and that "there are no post-state-commit `notifyWarning` sites". Both became false at D-141 when `surfaceDiscoveryWarnings` was added at `:2561`, and this phase makes the second notification fire for a whole new family of inputs. Pre-existing staleness, surfaced here because the phase's own tests now assert `notifications.length === 2` on the standalone path.

**Fix:** amend to "a single `MarketplaceNotificationMessage` row plus, when the install produced discovery warnings, one `notifyDiagnostic` block (D-141-03)".

### IN-05: The derived bridge roster is never asserted non-empty

**File:** `tests/architecture/workflows-single-parse.test.ts:122-124`

**Issue:** `bridgeModules()` returns `filesMatching(WORKFLOWS_BRIDGE_DIR, /\S/)`. A missing directory throws ENOENT from `readdir` (good), but a directory that exists and holds no `.ts` files returns `[]` silently, and the evaluator-surface case then screens the analyzer alone. The case's own comment promises "a bridge module added tomorrow is screened on the day it lands", which is true; it does not promise the roster is non-empty, and nothing checks it.

**Fix:** `assert.ok(modules.length >= 5, ...)` on the roster, or compare it to an independently maintained expected list the way `import-boundaries.test.ts` compares zones.

### IN-06: The new catalog fixture is not bound to `GATE_REASONS`

**File:** `tests/architecture/catalog-uat.test.ts:3629-3659`, `docs/output-catalog.md:1906-1920`

**Issue:** the `installed-with-workflow-gate-note` fixture hardcodes the check-9 sentence as a literal. The catalog gate proves fixture-and-document agree; nothing proves either agrees with `GATE_REASONS["meta-fields-invalid"]` in `bridges/workflows/discover.ts:173-174`. Reword the production sentence and the catalog stays green while its example states bytes the product no longer emits. The producer's bytes are pinned separately (install/reinstall/info suites), so drift shows up somewhere -- but not on the artifact that claims to be the output contract.

**Fix:** import `GATE_REASONS` into the fixture (the catalog test already imports production types), or add one case asserting the doc's `note:` line contains `GATE_REASONS["meta-fields-invalid"]`.

### IN-07: An ambiguous comment about what `update.ts` does

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1214-1216`, mirrored at `reinstall.ts:1065-1067`

**Issue:** *"it joins it HERE rather than through `splitStagingWarnings`, which is the call `update.ts` already makes for the same array and the same reason."* Read naively, "which is the call `update.ts` already makes" attaches to `splitStagingWarnings` and says the opposite of the truth: `update.ts::collectUpdateWarnings` (`:1414-1432`) deliberately does NOT route the workflows array through the classifier either. The intended referent is the whole join-at-the-call-site choice.

**Fix:** `"...rather than through \`splitStagingWarnings\`. \`update.ts::collectUpdateWarnings\` makes the same choice for the same array and the same reason."`

---

_Reviewed: 2026-09-09T07:35:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
