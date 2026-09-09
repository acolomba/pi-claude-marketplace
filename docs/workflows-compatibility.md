# Workflow compatibility

Feature-by-feature comparison of Claude Code's plugin `workflows` component against the Pi-Claude bridge, with the design rationale for which features were implemented, which were deferred, and which the bridge declares unsupportable.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes), `--` no equivalent on that side, or not stated by the sources read.

The upstream column reflects Claude Code's published plugins reference at [code.claude.com/docs/en/plugins-reference](https://code.claude.com/docs/en/plugins-reference) and the manifest schema and workflow API prose shipped inside the Claude Code 2.1.251 binary. The Pi column reflects the bridge sources under `extensions/pi-claude-marketplace/bridges/workflows/` and `extensions/pi-claude-marketplace/domain/`. Claims about the host engine come from `@quintinshaw/pi-dynamic-workflows` 3.10.1, published 2026-09-03, or from Spike 027, which re-drove the milestone's probes against that release.

Every claim about either engine carries its evidence grade where it is made. The grades are:

- **source-read at 3.10.1** -- the engine's own source was read and nothing was executed.
- **runtime-measured at 3.10.1** -- something was run against the installed engine and the result observed. More than one driver carries this grade: Spike 027's probes, and the live canary named beside the claim it establishes.
- **measured at 3.5.1** -- observed against an earlier engine release and not re-driven since.
- **read from the 2.1.251 binary** -- the string or schema was read out of the shipped Claude Code executable.
- **documented upstream** -- Claude Code's published reference states it.

A source read is not a runtime measurement, and this document never presents one as the other. Where a claim is a source read, the sentence says so, and the measurement that would upgrade it is named as work that has not been done rather than implied to have been done.

**Every `src/...` line-number citation below is pinned to 3.10.1 and is not maintained against later releases.** The engine is not vendored in this repository, so nothing here can detect that a citation has drifted, and the same absent exported contract that makes the storage layout a standing risk makes its line numbers one. Read that exact version to follow a citation -- `npm pack @quintinshaw/pi-dynamic-workflows@3.10.1` -- rather than whichever version is current. Re-reading the vendored internals against a newer engine is tracked as `WPIN-01`; until that lands, a citation that no longer lands on the code it names means the engine moved, not that the claim was wrong when it was read.

## Installing executable code

**This is the first bridge that installs executable code rather than data.** Every other component kind this extension installs is a descriptor: markdown a model reads, or JSON naming a command the host spawns out of the plugin's own tree. A workflow is third-party JavaScript. The bridge copies the script bytes verbatim into a JSON envelope it writes under the host engine's own storage root, outside the plugin tree, where a separate Pi extension -- `@quintinshaw/pi-dynamic-workflows` -- loads it and runs it. Nothing in this extension ever evaluates a script; `domain/workflow-script.ts` parses and never executes, and `bridges/workflows/stage.ts` copies bytes it never reformats, transpiles, minifies, re-encodes or line-ending-normalizes.

The host engine was chosen over `@nicknisi/pi-workflows` on the sandbox comparison below. The chosen engine runs a script inside a `vm.createContext` realm and deliberately injects no host built-ins; its `process` is a frozen stub exposing `cwd()` and nothing else (source-read at 3.10.1, `src/workflow.ts:1387,1399-1409`). The rejected engine runs the script with the real host `process`, its environment variables, real filesystem internals, and a `Function`-constructor path back into the host realm (measured at 3.5.1).

**Neither engine is a security boundary, and the chosen one says so about itself.** Its own comment above the determinism prelude reads: "vm is not a security sandbox -- an injected bridge function's `.constructor` is still the host Function, so a determined script could bypass this. The guard is best-effort against ACCIDENTAL nondeterminism from trusted (user / guided-LLM) scripts, not a security wall" (source-read at 3.10.1, `src/workflow.ts:405-416`). The comparison below is a difference of degree, not a boundary. A plugin author who ships a `workflows/` directory is shipping code that will run on other people's machines, and a user who installs such a plugin is accepting that.

## Manifest and discovery

| Field or behavior                                     | Claude Code | Pi  | Notes                                                                                                          |
| ----------------------------------------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------- |
| `plugin.json` `workflows` as a path string            | ✓           | ✓   | relative to the plugin root; read from the 2.1.251 binary                                                      |
| `plugin.json` `workflows` as an array of path strings | ✓           | ✓   | same schema, array arm; read from the 2.1.251 binary                                                           |
| a declared path naming a DIRECTORY                    | ✓           | ✓   |                                                                                                                |
| a declared path naming a `.js` FILE                   | ✓           | ✗   | the walk lists a directory, so a file target yields no scripts, no warning and no throw -- see disposition one |
| convention directory `<pluginRoot>/workflows/`        | ✓           | ✓   | scanned when the field is absent                                                                               |
| declaring the field REPLACES the convention directory | ✓           | ✗   | Pi UNIONs the declared paths with the convention directory (D-07), as it does for `commands` and `agents`      |
| `folder-shadowed-by-manifest` diagnostic              | ✓           | --  | under the union rule nothing is shadowed, so there is no diagnostic to raise                                   |
| recursive scan below the declared directory           | --          | ✗   | discovery is flat and non-recursive (WBRG-02)                                                                  |
| `.js`, `.mjs`, `.cjs` script suffixes                 | --          | ✓   | suffix matched case-insensitively, so `Thing.JS` does not carry `.JS` into the command name                    |
| symlinked script entries                              | --          | ✗   | refused in two layers, the dirent filter and an `lstat` under it (D-14)                                        |
| script bytes that are not valid UTF-8                 | --          | ✗   | a verbatim copy is the promise, so a lossy decode is a per-file skip rather than a mutated envelope            |
| `.claude/workflows/` project scripts outside a plugin | ✓           | ✗   | this extension installs plugin components only                                                                 |

The `workflows` manifest field is confirmed path-bearing with a `string | array` shape. Claude Code 2.1.251's own schema describes both arms as "Path to a workflows directory or .js file, relative to the plugin root. When set, the workflows/ directory is not auto-loaded -- list its files here if you want both." and "List of workflow directory or .js file paths. When set, the workflows/ directory is not auto-loaded." The schema body is written identically to the `themes` and `outputStyles` definitions, and the loader normalizes the field through the same array-or-single idiom it uses for `agents`. **That read of the shipped binary is graded HIGH; the published plugins reference page, which agrees, is graded MEDIUM** -- it is a rendering of the contract rather than the artifact that enforces it. Because the field is path-bearing, a `workflows` value that is neither a string nor an array of strings is a structural manifest defect and resolves `(unavailable)` rather than degrading to an unsupported kind; that verdict is pinned in `tests/domain/resolver.test.ts`.

Two divergences follow from the confirmation, and both are documented here rather than fixed. Upstream REPLACES: the default `workflows/` scan runs only while the manifest is silent, and declaring the field over an existing folder raises `folder-shadowed-by-manifest`. This project UNIONs, appending the convention directory after the declared paths, which is pre-existing D-07 behavior shared with `commands` and `agents`. And upstream admits a `.js` FILE path where this project's discovery walk expects a directory.

### Admit-versus-run divergence

The host engine refuses a script at **nine distinct checks** inside `parseWorkflowScript` (source-read at 3.10.1, `src/workflow.ts:1504-1564`). This bridge replicates **two** of them: the determinism screen and the parse. It admits shapes the other seven refuse, which means a script can install cleanly here and then refuse to run there. Six of those seven now produce an install-time warning naming the file and the check that will refuse it; the seventh is unreachable. A warning never changes what installs.

The failure is bounded and visible: the envelope is written, the command registers, and the engine reports the refusal the first time anyone runs it. Registration reads the envelope's `name` and `description` fields and never parses the script; the script is parsed only when a run starts (source-read at 3.10.1, `src/saved-commands.ts:52-71`, `src/workflow.ts:441`). Unlike the timing divergence the hooks bridge documents, this one IS observable to the person using the command, which is why it is stated as a divergence rather than absorbed into a `✓`. The signal also arrives earlier than the first run: for the six warned checks, the install, the reinstall, the update cascade and `info` each name the check, so an author reads it before anyone invokes the command.

| Script shape                                                         | Installs here                        | Engine at run time                                                      | Notes                                                                      |
| -------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `meta` declares no `description`, or an empty one                    | ✓ envelope written, no `description` | ✗ refused at check 9                                                    | the bridge never checks `description`; the engine requires a non-empty one |
| `meta` is not the first statement                                    | ✓                                    | ✗ refused at check 3                                                    | the bridge reads the last `meta` binding wherever it sits                  |
| `export let meta` / `export var meta`                                | ✓                                    | ✗ refused at check 4                                                    | the engine requires `const`                                                |
| `const meta` declared but not exported                               | ✓                                    | ✗ refused at check 3                                                    | the first statement is not an `ExportNamedDeclaration`                     |
| `export const meta = {...}, other = 1`                               | ✓                                    | ✗ refused at check 5                                                    | the engine allows exactly one declarator                                   |
| `meta` object with no `name` property                                | ✓ installs as `<plugin>:<file stem>` | ✗ refused at check 9                                                    | stem fallback, WNAM-02; the engine wants a non-empty `meta.name`           |
| `meta.name` that is not a literal (identifier, call, member, number) | ✓ installs as `<plugin>:<file stem>` | ✗ refused at check 8, or at check 9 for a number                        | the value is classified by node type here and never resolved               |
| `meta.name` written as a template literal WITH an interpolation      | ✓ installs as `<plugin>:<file stem>` | ✗ refused at check 8, "template interpolation not allowed in meta.name" | the installed command carries a name the script never declares             |

The template-literal row is the one worth reading twice. A template with no substitution -- `` name: `deploy` `` -- is read here exactly as the engine reads it, so both sides resolve `deploy` and nothing diverges. A template WITH a substitution is different: the bridge cannot resolve it without running the script, so it falls back to the file stem and installs the command under `<plugin>:<file stem>`, a name that appears nowhere in the script, while the engine resolves the script to no name at all. The upstream `meta` rules agree with the engine here -- Claude Code's own workflow prose requires the `meta` object to be "a PURE LITERAL -- no variables, function calls, spreads, or template interpolation" (read from the 2.1.251 binary) -- so this shape is one neither runtime accepts.

The `meta.description` gap is the widest of the eight rows, because it was invisible to the author: a script that declares a perfectly good `meta.name` and no description installs, registers a command, and dies at first invocation. That gap, and five more like it, are now stated at install time. Six of the seven checks this bridge does not replicate produce a per-script warning naming the file and the check; the classification table below says which, under `warn`. The install still succeeds, the envelope is still written, and the plugin's own row is unchanged.

**The bridge warns and does not refuse, and the two directions fail differently.** A warning this bridge gets wrong costs a reader one line they can ignore. A refusal it gets wrong costs a blocked install that only a release of this extension can clear. Replicating the engine's structural rules as refusals would also make this extension stricter than the engine the day a future release drops a rule, and the strict direction does not self-correct. So a gate reading here can add a line and nothing else: it cannot refuse a script, fail a plugin, or change a status, a glyph or a disposition. See Spike 027 for the re-measurement all of the above rests on.

### Refusal-check classification

The nine checks, in the order the engine runs them (source-read at 3.10.1, re-read 2026-09-08 against the same release and unchanged). `This bridge` takes one of three values. **replicate** means this bridge applies the same rule itself and refuses the file. **warn** means it admits the file, installs it, and names the check in a per-script warning. **neither** means it does nothing, and the row says why.

| #   | Check                                              | Engine's refusal message                                                                        | This bridge | Gate name                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `DETERMINISM_BLOCKLIST.test(script)` over raw text | "Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable"   | replicate   | --                         | the regex is vendored byte-for-byte, so a match is a per-file refusal here rather than a warning                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | `parse(script, ...)`                               | acorn's own `SyntaxError` text                                                                  | replicate   | --                         | a script acorn cannot parse is refused here too, and no check below is read off it                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | first statement is an `ExportNamedDeclaration`     | "`export const meta = { name, description, phases }` must be the first statement in the script" | warn        | `meta-not-first-export`    | covers a statement placed before the export, and a `const meta` that is never exported                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | the declaration is a `const` `VariableDeclaration` | "meta export must be `export const meta = ...`"                                                 | warn        | `meta-not-const-export`    | covers `export let`, `export var`, a bare `export { meta }`, and a first export that declares no variable                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | exactly one declarator                             | "meta export must declare only `meta`"                                                          | warn        | `meta-not-sole-declarator` |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | the declarator id is an `Identifier` named `meta`  | "meta export must declare `meta`"                                                               | warn        | `meta-not-named-meta`      | the wrong-name arm is warned; the destructuring arm, `export const { meta } = pkg`, is a per-file skip and earns that message instead                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7   | the declarator has an initializer                  | "meta must have a literal value"                                                                | neither     | --                         | UNREACHABLE, not undetectable: `export const meta;` is a syntax error acorn rejects at check 2 (`Unexpected token (1:17)`), and every non-`const` form fails check 4 first, so no parseable script arrives here                                                                                                                                                                                                                                                                                                                           |
| 8   | `evaluateLiteral` on the initializer               | per-node, e.g. "template interpolation not allowed in meta.name"                                | warn        | `meta-not-pure-literal`    | every arm is decidable from the node type, so nothing here needs the script to be evaluated. A spread or a computed key that could supply or overwrite `name` -- that is, one standing AFTER the last literal `name` -- is a per-file skip instead; one standing before it is admitted and warned here, because last-wins means the literal overwrites whatever the spread contributed. The reserved key names are read at 3.10.1 and are not an exported contract, so a name a later release adds is a missed warning, never a false one |
| 9   | `validateMeta` on the evaluated object             | one of six messages, below                                                                      | warn        | `meta-fields-invalid`      | the `description`, `model` and `phases` arms are warned. A `meta` that is not an object is a per-file skip, and an empty `meta.name` is a per-file refusal, so both of those reach the author another way                                                                                                                                                                                                                                                                                                                                 |

**The order is counter-intuitive and load-bearing: the determinism screen runs BEFORE the parse.** A script that is both nondeterministic and unparseable is reported by the engine as nondeterministic. This bridge deliberately reverses that pair -- it settles unparseable first, because acorn fills its comment and token arrays as it scans and then throws, so on a parse failure those arrays are partially filled and any classification built on them would be unsound. For a script with both defects the two sides therefore disagree about which one to name.

A script gets at most one warning, and it names the check the engine stops at rather than every check the script trips. The engine refuses at its first failure, so naming a later check would describe an object the engine never reads. Where the bridge's own walk looks for `meta.name` and reaches a softer verdict -- falling back to the file stem where the engine refuses -- the check rides that existing caveat rather than adding a second line for the same file.

Check 9 throws **six distinct messages** (source-read at 3.10.1, `src/workflow.ts:1611-1626`):

- "meta must be an object"
- "meta.name must be a non-empty string"
- "meta.description must be a non-empty string"
- "meta.model must be a string"
- "meta.phases must be an array"
- "each meta phase must have a title string"

**This document states no total count of the engine's refusal messages, and none should be added.** Check 2's message is acorn's own parser text, which varies with the input and cannot be enumerated, so any total would be a number with no honest counting rule behind it. Nine checks and six `validateMeta` messages are both countable; their sum is not.

## Script semantics

| Feature                                                                                   | Claude Code     | Pi  | Notes                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------- | --- | ------------------------------------------------------------------------------------------------ |
| `export const meta` as the first statement                                                | ✓               | ⚠   | required upstream and by the engine; warned at install time here, never enforced                 |
| `meta.name`, `meta.description` required                                                  | ✓               | ⚠   | the bridge requires a readable name; it does not require a description, and warns without one    |
| `meta` must be a pure literal                                                             | ✓               | ⚠   | read from the 2.1.251 binary; the bridge stem-names a non-literal name and warns, never refusing |
| `meta.phases`, `meta.model`                                                               | ✓               | ✓   | carried through untouched; the bridge reads only `name` and `description`                        |
| determinism rule against `Date.now`, `Math.random`, `new Date()`                          | ✓               | ✓   | Claude Code states the same rule in the same words; the engine's regex is vendored byte-for-byte |
| script size cap                                                                           | ✓ 524,288 bytes | ✗   | read from the 2.1.251 binary; the bridge imposes no cap of its own                               |
| `agent()`, `parallel()`, `pipeline()`, `phase()`, `log()`, `args`, `budget`, `workflow()` | ✓               | --  | the runtime surface belongs to whichever engine runs the script, not to this bridge              |
| TypeScript syntax in a script                                                             | ✗               | ✗   | both sides parse plain JavaScript only                                                           |
| script bytes preserved verbatim through installation                                      | --              | ✓   | round-trip checked on read; a file that fails the check is skipped rather than installed mutated |

## Sandbox

The columns here name two Pi extensions rather than the two hosts, because the question this table answers is which engine to trust with third-party code. Rows carry different grades and each row states its own; do not read the table as one uniform measurement.

| Probe                         | `@quintinshaw/pi-dynamic-workflows` (chosen)                | `@nicknisi/pi-workflows` (rejected) | Grade                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `process` own keys            | `cwd` only, on a frozen stub                                | the real host `process`             | source-read at 3.10.1 (`src/workflow.ts:1387`, `src/workflow-capability-contract.ts:457`)                                                                            |
| `process.env`                 | `undefined`                                                 | an object carrying 60 variables     | runtime-measured at 3.10.1 (Spike 027)                                                                                                                               |
| `process.binding('fs')`       | `TypeError`                                                 | real filesystem internals           | measured at 3.5.1, not re-driven since                                                                                                                               |
| `Function`-constructor escape | no escape through injected built-ins                        | reaches the host realm              | measured at 3.5.1, corroborated by a source read at 3.10.1 whose own comment gives the reason                                                                        |
| clock and RNG                 | two layers: refused pre-parse AND replaced inside the realm | live values                         | refinement at 3.10.1: `DETERMINISM_PRELUDE` (`src/workflow.ts:417-434`) replaces `Math.random` and `Date` in-realm, so the pre-parse blocklist is not the only guard |

`vm.createContext` plus `runInContext` is unchanged from the earlier release (source-read at 3.10.1, `src/workflow.ts:1399,1409`). Read the caveat under "Installing executable code" alongside this table: the engine's authors state that `vm` is not a security sandbox, and the escape they name is the same `.constructor` path this table's fourth row measures on the other engine.

### `agent()` failure semantics

The chosen engine sorts a failed `agent()` call into a recoverable class and a non-recoverable one, and the class decides the outcome. The two hosts agree on the first and part company on the second:

| Runtime                             | On a failed `agent()` call                                                 | Grade                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Claude Code                         | resolves to `null`                                                         | read from the 2.1.251 binary, whose own prose says to filter with `.filter(Boolean)` |
| `@nicknisi/pi-workflows`            | throws                                                                     | **runtime-measured**                                                                 |
| `@quintinshaw/pi-dynamic-workflows` | resolves to `null` when the failure is recoverable, rejects when it is not | **runtime-measured at 3.10.1** by `tests/live-uat/workflow-agent-failure-canary.mjs` |

A recoverable failure resolves to `null` once the retry budget is exhausted, and the default budget is a single attempt (source-read at 3.10.1, `src/workflow.ts:990-995,791-792`). The engine's error classification ends in a catch-all arm that marks any plainly-thrown `Error` recoverable (`src/errors.ts:200-204`), so `null` is the ordinary outcome rather than an edge case: a subagent that dies because no credential resolves comes back as `null`. Only the non-recoverable class rejects, and its codes are named ones -- `MODEL_NOT_FOUND`, `AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED`, `SCRIPT_VALIDATION_ERROR` -- each carrying `recoverable: false`, so a reader can tell which class they hit from the error itself.

This document previously said that every failure branch in the chosen engine's `agent()` throws. That was a source read, and driving the engine overturned it. The canary named in the table observed both sides of the split in one credential-free run: a missing-provider failure resolved to `null`, and a model spec resolving to nothing rejected with `MODEL_NOT_FOUND`.

The two engines therefore agree on the ordinary failure. Upstream's own contract is conditional in the same way -- it returns `null` when the subagent "dies on a terminal API error after retries (filter with `.filter(Boolean)`)" (read from the 2.1.251 binary) -- and the engine's recoverable class is the direct analogue of that condition. What remains is the narrower divergence: on the non-recoverable class this engine rejects, and an uncaught rejection ends the whole run and aborts every sibling call still in flight (source-read at 3.10.1, `src/workflow.ts:1430-1471`).

The practical consequence for a plugin author inverts with it. A script written for Claude Code that fans out and drops falsy results -- a `pipeline(...)` or `parallel(...)` followed by `.filter(Boolean)` -- does not die here on the ordinary failure; it drops the failed items and finishes. Both fan-out helpers carry the same recoverable-to-`null` arm as a bare `agent()` call: three deliberately failed items came back as three rows, none survived the filter, and the run completed (runtime-measured at 3.10.1). What such a script does need to defend against is the non-recoverable class, which ends the run instead of yielding a `null` the filter can drop.

That pattern is what upstream scripts actually use. In Claude Code's own marketplace clone `claude-plugins-official`, the two Anthropic-authored plugins that ship workflows -- `claude-security` 0.11.0 and `code-modernization`, which declares no version -- carry seven scripts between them, read 2026-09-09. Counting textual occurrences rather than matching lines, because one of those scripts is minified onto a single line and holds 14 `.filter(Boolean)` occurrences by itself: six of the seven scripts call `.filter(Boolean)` (26 occurrences), six call `parallel()` (14 calls), and two call `pipeline()` (3 calls). Those are three separate counts and not one figure. They come from an un-pinned clone on one machine, and are given with their provenance and their counting rule so a reader holding the same clone can re-derive them; a reader without it should take the consequence above, which follows from the engine's code rather than from any count.

## Naming

A workflow's command name is generated as **`<plugin>:<name>`** -- the plugin name, a literal colon, and the workflow's own `meta.name`, with a leading `<plugin>-` stutter elided from the name half. The name comes from `meta.name` and not from the file stem, because real plugins call their files `<name>.workflow.js` and stem naming would misname every command such a plugin ships.

| Rule                                          | Claude Code | Pi  | Notes                                                                                                                                                 |
| --------------------------------------------- | ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| name taken from `meta.name`                   | ✓           | ✓   | file stem only as a fallback, which the engine then refuses to load                                                                                   |
| `<plugin>:` prefix on the installed command   | --          | ✓   | the same colon form the commands bridge uses                                                                                                          |
| leading `<plugin>-` elided from the name half | --          | ✓   | `acme` plus `acme-audit` gives `acme:audit`; an elision that would empty the head does not fire                                                       |
| maximum name length                           | --          | 128 | the engine's own cap, replicated (`isSafeSavedWorkflowName`)                                                                                          |
| leading or trailing whitespace                | --          | ✗   | the engine requires `name.trim() === name`                                                                                                            |
| whitespace, `/`, `\`, NUL inside the name     | --          | ✗   | the engine's own screen, replicated                                                                                                                   |
| control and format characters                 | --          | ✗   | `\p{Cc}` and `\p{Cf}`, the engine's own screen, replicated                                                                                            |
| unpaired surrogates                           | --          | ✗   | one screen deliberately stricter than the engine -- such a name cannot round-trip through a path, so two of them collapse onto one file with no error |
| case folding                                  | --          | ✗   | neither the bridge nor the engine folds case anywhere on the install-to-registration path                                                             |
| Unicode normalization                         | --          | ✗   | neither the bridge nor the engine normalizes                                                                                                          |

**String identity is exact bytes.** The engine compares the saved name against its registered commands as an exact string, derives the envelope's filename as `${name}.json`, and applies no case folding and no Unicode normalization anywhere on that path (source-read at 3.10.1, `src/workflow-saved.ts:84-137`, `src/saved-commands.ts:21-27`). Two names that differ by a single byte are two commands; two names that a human would read as the same word but that differ in case or in Unicode composition are also two commands. The bridge's own generator and its replica of the engine's validator behave identically, which is what makes the round trip predictable, and the replica is pinned in `tests/domain/name.test.ts`.

One name-shaped divergence has nothing to do with byte identity. For a `meta.name` the bridge cannot read as a literal -- including the interpolated template case in the divergence table above -- the command installs under `<plugin>:<file stem>`, a name the script does not declare, and the engine, which reads the script rather than the envelope's name field, resolves no name for it at all.

Two further facts about the installed name. If a command of that name is already registered by Pi or another extension, the engine declines to register the envelope and says so, so the workflow silently does nothing under a taken name. And the host exposes no way to unregister a command, so a command an uninstalled envelope registered stays live and runnable for the rest of the session; the uninstall row says so with a `{stale workflow command}` token rather than reporting a clean removal.

## Host engine requirements

**Two peer floors are in play, and they belong to two different packages.**

- `pi-claude-marketplace` peers on `@earendil-works/pi-coding-agent >=0.80.5`. This project has not raised its own floor for the workflows bridge, and nothing in this document asks it to.
- `@quintinshaw/pi-dynamic-workflows` 3.10.1 peers on `@earendil-works/pi-coding-agent >=0.80.8` and `@earendil-works/pi-tui >=0.80.6` (verified against the published package metadata).

A user on a Pi between 0.80.5 and 0.80.7 satisfies this extension's floor and not the engine's. Workflow envelopes install correctly and nothing runs them. That gap is the engine's requirement, not this extension's, and it cannot be closed from here.

Install the engine with:

```bash
pi install npm:@quintinshaw/pi-dynamic-workflows
```

**Name the scoped package.** `pi-workflows` and `pi-dynamic-workflows` are two real, different packages on npm. The unscoped one is the engine this project rejected on the sandbox comparison above, so an install instruction that drops the scope sends the operator to the wrong engine -- and to the more permissive one.

## When the host engine is absent

The bridge writes envelopes whether or not the engine is loaded in the session. The install succeeds, the envelope bytes are byte-identical to what an engine-present install writes, and the row carries the `{requires pi-dynamic-workflows}` marker. A missing companion degrades an install; it never blocks one.

**The marker bytes are the same on every surface; the severity they arrive at is not.** Three surfaces raise the row from `info` to `warning` when the engine is absent: a standalone install, the manual update cascade, and a standalone enable. On those the raise says what the tri-state model means by `warning` -- the operation WAS carried out, but the desired state is not reached, because nothing runs the workflows yet. Every other surface renders the identical marker at its own base severity, normally `info`: the read-only inventory surfaces (`list`, `info`), the load-time reconcile projection, `import`, `reinstall` and the autoupdate cascade. They report a standing fact about a record rather than a shortfall in an action just taken, so the same plugin can read `warning` from `install` and `info` from `list` in one session. This split is not particular to workflows -- the `requires pi-subagents` and `requires pi-mcp` markers have behaved this way since they were introduced, and the workflows marker follows them rather than diverging.

Writing anyway is only correct because recovery costs nothing: installing the engine and running `/reload` is enough. The engine registers saved workflows on `session_start` by walking its saved directories, with no index, no install-time registration hook and no engine API to call, so an envelope already on disk is picked up on the next session start regardless of who wrote it or when (source-read at 3.10.1, `src/pi-extension.ts`, `src/saved-commands.ts:119-137`, `src/workflow-saved.ts:287`). No reinstall is required.

Two structural guarantees back that up rather than leaving it a claim in prose. `tests/orchestrators/plugin/install.test.ts` installs one fixture twice, differing only in whether the session reports the engine's tool, and compares the raw envelope bytes. And `tests/architecture/no-probe-in-workflows-bridge.test.ts` refuses any import of the soft-dependency probe into the modules that write, replace and remove envelopes, so no future change can make the write conditional on the probe's answer. Marker coverage across every surface that renders a plugin row is held by `tests/architecture/workflows-marker-coverage.test.ts`, and the rendered marker bytes are pinned in `docs/output-catalog.md` under the byte gate in `tests/architecture/catalog-uat.test.ts`.

## Upstream stability

**The engine's storage contract is private, and this is a stated risk rather than a footnote.** The envelope shape, the working-directory key derivation, the saved-directory layout and the name validator are all internals, and the engine exports a contract for none of them. Its version number offers no cover either way: the package is well past 1.0, and it has still published 57 versions across three majors in fourteen weeks -- `1.0.0` on 2026-05-30 through `3.10.1` on 2026-09-03 (`npm view @quintinshaw/pi-dynamic-workflows versions time`). Semver binds what a package exports, so a release of any size can move an unexported layout without breaking its own promise. This bridge writes into that layout directly, so an engine release that changes it can strand already-installed workflows until they are reinstalled.

Specifically, at 3.10.1:

- User-scope envelopes live under `~/.pi/workflows/saved/`, project-scope under `~/.pi/workflows/projects/<key>/saved/`, where `<key>` is a slug of the project directory's basename joined to the first 12 hex characters of a SHA-256 of its resolved absolute path (source-read at 3.10.1, `src/workflow-paths.ts:36-55`).
- There is no environment-variable override and no settings knob to relocate that storage. The home directory is read from `os.homedir()` and nothing else.
- The vendored determinism blocklist is a private constant with no exported contract, so it has to be re-checked against each engine upgrade rather than imported.
- The engine depends on `acorn ^8.16.0`, the same range this bridge declares for its own `meta.name` extraction. The bridge keeps its own direct dependency, because it parses scripts whether or not the engine is installed.

## Install-time disposition

The bridge picks one of five responses when it meets a workflow script, or a declared workflows path, it cannot install as written:

**Nothing discovered** -- the walk finds no candidate scripts, raises no warning and throws nothing. The plugin installs, it declares no host-engine dependency, and its row carries no `requires pi-dynamic-workflows` marker, because that marker is derived from the number of envelopes actually staged. Applies to:

- an EMPTY `workflows/` directory: the plugin installs exactly as a plugin with no workflows does
- a declared component path naming a `.js` FILE rather than a directory, which is legal upstream: the directory read answers `ENOTDIR` and the tolerant reader returns an empty list, so the file is silently dropped
- a declared directory that does not exist: `ENOENT`, handled the same way
- a directory holding only dotfiles, subdirectories, symlinks or non-script suffixes

**Installed with a caveat** -- the envelope IS written and the command registers when the engine picks it up, but the engine refuses the script at first invocation. A per-script warning names the file and the reason. The row states the installed fact before the caveat, because a refusal-shaped message would report something that did not happen. Applies to:

- a `meta` object whose key set is readable but which declares no `name` property, so the command installs under the file stem instead
- a `meta.name` that is not statically knowable text: an identifier, a call, a member expression, a number, or a template with an interpolation, which also installs under the file stem
- a script that trips one of the six warned checks in the classification table above, whatever its name resolves to -- the widest case being a readable `meta.name` with no `meta.description`

**Per-file skip** -- nothing is installed for that file, a warning names the file and its directory, and the rest of the plugin installs normally. Applies to:

- a script declaring no `meta` at all, which is what a shared helper module in the same directory looks like
- a `meta` declared as something other than an object literal
- a `meta` carrying a spread or a computed key that could supply or overwrite `name`, so its key set cannot be read without running the script
- a file that could not be inspected or read, or whose bytes do not survive a UTF-8 round trip

**Per-file refusal** -- the file is installable-shaped and is deliberately not admitted. A warning names it; the rest of the plugin still installs. Applies to:

- a script the vendored determinism blocklist matches, including a match confined to a comment or a string literal -- the engine screens raw text and refuses the script either way, so the classification changes the message and not the verdict
- a script that is not parseable JavaScript
- a script whose generated name the engine's own name rules would reject

**Whole-plugin failure** -- the defect belongs to the SET rather than to one file, so refusing one arbitrary member would be silent misnaming. The install fails. Applies to:

- two scripts in one plugin whose names generate the same command name; both file names are listed, because neither one reveals the clash on its own
- an unsafe plugin name, which disqualifies every script in the plugin at once
- a declared workflows path that resolves outside the plugin root, which is a defect of the manifest rather than of one file

## Further reading

- [Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference) -- the upstream authoritative manifest reference, including the component-path field table that `workflows` belongs to, the relative-path rules, and the declared-versus-convention loading semantics this bridge diverges from.
- `@quintinshaw/pi-dynamic-workflows` on npm -- the host engine that runs installed workflow scripts, contracting the saved-envelope shape, the saved-directory layout, the script API a workflow body may call, and the nine-check admission path a script must pass before it runs.
