---
spike: 009b
idea: claude-workflows-bridge
name: script-trust-boundary-nicknisi
type: comparison
validates: "Given the same script, when executed by @nicknisi/pi-workflows, then measure the same privilege gap and DSL drift head-to-head against 009a"
verdict: "⚠ PARTIAL (loses)"
related: ["008", "009a"]
tags: [pi-extension, workflows, trust-boundary, dsl, comparison]
---

# Spike 022b: script-trust-boundary-nicknisi

## What This Validates

Comparison spike, variant b of 2 (see
`../009-a-script-trust-boundary-quintinshaw/`). Same fixture, same probes,
different engine.

`@nicknisi/pi-workflows` entered this investigation as the **structurally
perfect** bridge target: it stores saved workflows as plain `.js` files (a
byte-identical copy of a Claude script, no transformation) in
`getAgentDir()/workflows/` and `<cwd>/<CONFIG_DIR_NAME>/workflows/` -- exactly
our two scope roots, with no index file to mutate. This spike asks what that
convenience costs.

## Research

`@nicknisi/pi-workflows` 0.2.1, 205 downloads/month. Its own README is candid
about the execution model:

> The script executes **in the host process with full Node access** --
> `process`, `require`, and `fs` are all reachable, the same trust boundary as
> the `bash` tool.

Reading `engine.ts` (which imports only `node:vm` -- no other dependency, which
is what makes it directly harnessable):

```ts
const wrapped = `(async function(args, agent, parallel, pipeline, phase, log, budget, cwd, metaHolder){\n${stripped}\n})`;
const raw = new vm.Script(wrapped, { filename: 'workflow.js' }).runInThisContext();
```

`runInThisContext()` -- not `runInContext(freshContext)`. The compiled function
closes over the **host realm**. Globals are passed as parameters, but nothing is
taken away.

One correction to the marketing: the package describes itself as the front door
to "the first-party workflow engine". Verified against
`@earendil-works/pi-coding-agent@0.84.2` directly -- `dist/index.d.ts` exports
zero `workflow*` symbols and `docs/` has no workflows page. "First-party" here
means first-party to `@nicknisi/pi-shared`, not to Pi. Pi core has no workflow
API at all.

## How to Run

```bash
npm install @nicknisi/pi-workflows@0.2.1
node run.mjs                             # sandbox probe
node run.mjs determinism.workflow.js     # all three succeed -- no guard
node run.mjs agent-failure.workflow.js   # agent() throws
```

`probe.workflow.js` and `determinism.workflow.js` are byte-identical to the
copies in `../009-a-script-trust-boundary-quintinshaw/`.

## What to Expect

The same JSON report shape as 009a, with materially different values.

## Investigation Trail

1. **First run failed to compile, on a comment.** The fixture's header comment
   quoted the meta-declaration phrase while explaining the contract. The engine
   rejected the file with `SyntaxError: Unexpected token 'export'`.

   Root cause, from `engine.ts`:

   ```ts
   const STRIP_META = /export\s+const\s+meta\s*=/;              // NOT global
   const stripped = script.replace(STRIP_META, 'const meta = metaHolder.value =');
   ```

   `String.replace` with a non-global regex rewrites only the **first** match.
   My comment was the first match, so the rewrite was consumed there and the
   real declaration survived as a stranded `export`, which `vm.Script` rejects.
2. **Confirmed with a control** rather than assuming: an otherwise identical
   script whose comment omits the phrase compiles and runs clean
   (`{"ok":true,"sawGlobals":"function,function"}`). Hypothesis verified, not
   inferred.
3. **Ran the shared probe** once the trigger phrase was removed.
4. **Sharpened an ambiguous escape probe.** `Function('return typeof process')()`
   returns `"object"` on both engines -- meaningless, since 009a's stub is also
   an object. Switched to `process.env`, which the host has and the stub does not.
5. **Probed practical capability.** `process.mainModule` is `undefined` under
   ESM, so the textbook `mainModule.require('fs')` route fails here too -- worth
   stating precisely rather than over-claiming. `process.binding` is the route
   that does work.
6. **Measured `agent()` failure semantics.** The first attempt threw a
   `TypeError` from inside the engine because the stub spawn returned a
   malformed result -- that was my bug, not a finding. Re-ran with the engine's
   documented `EngineSpawnFail` shape (`{ok, kind, error, text, usage}`) to get
   an answer attributable to the engine.

## Results

**VERDICT: PARTIAL, and it loses the head-to-head.** The script runs -- but the
sandbox Claude authors rely on is entirely absent.

### Measured, one identical fixture, head-to-head

| Probe | 009a quintinshaw | 009b nicknisi |
| --- | --- | --- |
| `process` own keys | `cwd` (stub) | **`version,versions,arch,platform,release,_rawDebug`** (real) |
| `process.env` type | `undefined` | **`object`** |
| `process.env` size | n/a | **60 vars** |
| `process.pid` | `undefined` | **25047** |
| `process.binding` | `undefined` | **`function`** |
| `process.binding('fs')` | TypeError | **`getFormatOfExtensionlessFile,access,close,existsSync`** |
| `process.binding('spawn_sync')` | TypeError | **`object`** |
| `Function -> process.env` | `no-env` (no escape) | **60 vars (host realm)** |
| realm `globalThis` keys | `agent,parallel,pipeline,workflow,verify,...` | **`global,clearImmediate,setImmediate,clearInterval,...`** |
| `determinism.workflow.js` | rejected pre-parse | **all three succeed** |

`Date.now()`, `Math.random()`, and `new Date()` all return live values --
no guard of any kind, static or in-realm.

### What this means for a bridge

Installing a third-party Claude plugin whose `workflows/` directory is bridged
onto this engine hands that plugin's JavaScript:

- every environment variable in the Pi process, including whatever API keys and
  tokens the user's shell carries;
- `process.binding('fs')` and `process.binding('spawn_sync')`, i.e. disk and
  process-spawn primitives;
- the host realm's `globalThis`.

Upstream Claude grants none of these. Our other bridges install **data** --
markdown, JSON config. This would be the first bridge to install **executable
code**, and it would execute with strictly more privilege than the ecosystem it
came from. That is a change to this extension's threat model, not a feature
addition. (The probe's secret-name scan came back empty here only because the
harness shell is clean; a real `pi` session inherits the user's environment.)

### DSL divergence: `agent()` throws where Claude returns null

Empirically, with the engine's own documented failure shape:

```text
nicknisi, well-formed failing spawn -> THREW Error: api_error: simulated failure
```

Claude documents the opposite, and builds its canonical example on it:

> An `agent()` call resolves to `null` if you stop it mid-run or it hits an
> unrecoverable API error. `pipeline()` keeps that `null` in the results array,
> which is why the example ends with `.filter(Boolean)`.

So the single most-documented Claude pattern --
`pipeline(files, f => agent(...))` then `.filter(Boolean)` -- inverts here. A
failing agent throws instead of yielding a `null` for `.filter(Boolean)` to
drop, and the rejection takes the whole run down where upstream would have
degraded to a partial result. A verbatim copy of a real Claude workflow is
therefore **not** semantically portable, even though it is textually portable.

`phase()` is also logging-only here (their README says so explicitly: "NOT a
budget boundary"), where Claude's groups agents and carries phase metadata.

### The `STRIP_META` defect

A workflow script that mentions its own meta-declaration phrase in a comment or
string before the real declaration fails to compile, with a `SyntaxError` that
points at the real declaration rather than at the comment that caused it. Real
Claude workflow scripts carry explanatory headers (spike 021 found one opening
with 20 lines of prose), and a header explaining the script's own contract is
a natural thing to write.

This is the same class of defect as 009a's raw-text determinism blocklist:
**both engines preprocess script source with text-level regexes that cannot
distinguish code from comment.** Two independent implementations, same
structural mistake. Any bridge that copies scripts verbatim inherits whichever
one its target engine has, and neither failure mode names its real cause.

### Caveats

- Measured at 0.2.1, a 0.x package at 205 downloads/month with the engine's
  execution model as its most likely churn point.
- `require` is `undefined` in both engines (ESM context). The privilege finding
  rests on `process`/`process.binding`, not on `require`.
- The stub spawn means the `agent()` result path was exercised, but no real
  subagent ran. The throw originates in the engine's own result handling.
