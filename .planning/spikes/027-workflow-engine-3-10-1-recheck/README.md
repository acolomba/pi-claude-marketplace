# Spike 027: Workflow engine 3.10.1 re-check

**Idea key:** claude-workflows-bridge
**Type:** standard
**Verdict:** ✓ VALIDATED (two claims regraded, one new gap)

## Question

Spikes 021-026 measured every load-bearing claim of the `workflows` milestone
against `@quintinshaw/pi-dynamic-workflows` **3.5.1**. That version is now six
minors old: 3.10.1 published 2026-09-03. Which measured claims survive?

## Method

A disposable engine tree, per the scratch-engine route:

```bash
npm install @quintinshaw/pi-dynamic-workflows@3.10.1 acorn@^8.16.0 \
            @earendil-works/pi-server
HOME=<scratch> node <probe>.mjs
```

The probes from 023 (`paths.mjs`, `plant.mjs`), 025 (`keyparity.mjs`), 024
(`name-interop.mjs`), 022a (`run.mjs`), and 026 (`extract.mjs`) were re-driven
unchanged except for the engine version and an isolated `HOME`.

`name-interop.mjs` was pointed at **this branch's** `domain/name.ts`, not the
spike branch's, so the reuse claim is measured against post-#167 code.

## Results

| Claim | Requirement | 3.5.1 | 3.10.1 |
| --- | --- | --- | --- |
| Path model: user / project / legacy saved dirs | WPTH | held | **holds, unchanged** |
| Project-key derivation reproduces exactly | WPTH-02 | held | **holds, 14/14 cases** |
| Hand-planted envelope found by `storage.list()` | WBRG-04 | held | **holds, all three tiers** |
| Script survives the round trip verbatim | WBRG-01 | held | **holds** |
| `<plugin>:<name>` accepted by `isSafeSavedWorkflowName` | WNAM-06 | held | **holds** |
| `generatedCommandName` output accepted | WNAM-06 | held | **holds, incl. RN-1 elision** |
| acorn beats regex on comment/string decoys | WNAM-01 | held | **holds** |
| Script sandbox: no `process.env`, no `require` | WBRG | held | **holds** |
| Determinism gate refuses `Date.now()` | WGATE | held | **holds, same code** |

### Negative control

`keyparity-negctl.mjs` is `keyparity.mjs` with the hash slice changed from 12
to 10 characters. It reports **14 mismatches out of 14**, so the parity probe
discriminates rather than passing by construction.

## Regraded

**The admission-gate count was wrong in both directions.** The milestone
roadmap says the engine "runs seven gates ... the bridge replicates one";
`WGATE-02` says "the six gate checks". Neither matches the source. At 3.10.1
`parseWorkflowScript` refuses a script at **nine distinct checks**, and
`validateMeta` alone carries four messages, for twelve refusal messages in all.

In execution order:

| # | Check | Refusal message | Bridge today |
| --- | --- | --- | --- |
| 1 | determinism blocklist over raw text | must be deterministic | **replicates**, refuses |
| 2 | `parse()` | acorn `SyntaxError` | **replicates**, refuses |
| 3 | first statement is `ExportNamedDeclaration` | `export const meta = ...` must be the first statement | no |
| 4 | declaration is a `const` `VariableDeclaration` | meta export must be `export const meta = ...` | no |
| 5 | exactly one declarator | meta export must declare only `meta` | no |
| 6 | declarator is an Identifier named `meta` | meta export must declare `meta` | partly |
| 7 | declarator has an initializer | meta must have a literal value | partly |
| 8 | `evaluateLiteral` on the initializer | meta must have a literal value | partly, falls back |
| 9 | `validateMeta` | `meta.name` / `meta.description` / `meta.model` / `meta.phases` | name only |

Note the order: **determinism runs before the parse**, so a script that is both
nondeterministic and unparseable reports the determinism failure.

The "partly" rows are where the bridge's acorn walk looks for the same thing
for its own reason (finding `meta.name`) and reaches a softer verdict — it
falls back to the file stem where the engine refuses.

**`meta.description` is an unnamed gap.** The engine requires a non-empty
string. The bridge never checks it, and the envelope carries `description`
as a field it fills from `meta`. A Claude script with no `meta.description`
therefore installs, registers a command, and dies at first invocation — the
exact failure mode `WGATE-01` exists to prevent, on a field no phase document
mentions.

**`agent()` failure semantics stay unmeasured.** Driving them still needs the
spawn machinery the fixtures avoid, so the null-vs-throw divergence keeps its
source-read grade. Unchanged from 3.5.1.

## New findings

**The engine's peer floor is above ours.** 3.10.1 peers on
`@earendil-works/pi-coding-agent >=0.80.8` and `@earendil-works/pi-tui
>=0.80.6`. This project peers on `pi-coding-agent >=0.80.5`. A user between
0.80.5 and 0.80.7 satisfies our floor and not the engine's, so the workflow
envelopes install and nothing runs them. The compatibility document has to
state the engine floor separately from ours.

**The engine depends on `acorn ^8.16.0`.** The same range the bridge needs for
`meta.name` extraction. The bridge still declares its own direct dependency,
because it parses scripts whether or not the engine is installed.

**`runWorkflow` gained a transitive requirement.** At 3.10.1 it reaches
`@earendil-works/pi-coding-agent/dist/experimental/server.js`, which imports
`@earendil-works/pi-server`. Without that package the call fails with
`ERR_MODULE_NOT_FOUND` before any script is parsed. 3.5.1 ran the same fixture
with no such install. This affects probes only -- the bridge never calls
`runWorkflow` -- but any future gate probe has to install the peer first.

## Files

- `keyparity-negctl.mjs` -- the mutated parity probe used as the negative
  control. The unmutated original stays in `025-canonical-path-mechanics/`.
