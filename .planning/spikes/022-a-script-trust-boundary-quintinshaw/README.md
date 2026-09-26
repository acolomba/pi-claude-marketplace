---
spike: 009a
idea: claude-workflows-bridge
name: script-trust-boundary-quintinshaw
type: comparison
validates: "Given a Claude-shaped workflow script, when executed by @quintinshaw/pi-dynamic-workflows, then measure the privilege gap vs Claude's sandbox and the DSL semantic drift"
verdict: "✓ WINNER"
related: ["008", "009b"]
tags: [pi-extension, workflows, trust-boundary, dsl, comparison]
---

# Spike 022a: script-trust-boundary-quintinshaw

## What This Validates

Comparison spike, variant a of 2 (see `../009-b-script-trust-boundary-nicknisi/`).

Spike 021 established that real Claude plugins ship workflow scripts, and that
one of them (`Spark-To-Paper-Skills/paperjury`) documents in its own source that
*"the Workflow sandbox cannot write files."* Script authors write **against**
Claude's sandbox guarantee. This spike asks what happens to that guarantee when
the same script is executed by a Pi workflow engine instead.

Upstream Claude's documented runtime constraints
(`code.claude.com/docs/en/workflows`, "Behavior and limits"):

- "No direct filesystem or shell access from the workflow itself"
- "No module loading: a script that contains `import()` fails before the run starts"
- `Date.now()` / `Math.random()` / argless `new Date()` are unavailable (they
  would break run resume)
- `agent()` "resolves to `null` if you stop it mid-run or it hits an
  unrecoverable API error"

## Research

`@quintinshaw/pi-dynamic-workflows` 3.5.1, 29,952 downloads/month, 50 releases,
peer `@earendil-works/pi-coding-agent >=0.80.8`. It self-describes as
"Claude-Code-style dynamic workflows for Pi" and credits Anthropic's dynamic
workflows announcement directly.

Reading the shipped runtime rather than the README (per the spike-006
convention), `src/workflow.ts` builds an explicit sandbox:

```ts
const context = vm.createContext({
  ...projectGlobals,
  // Object/Array/JSON/Math/Date/Promise/Set/Map/etc. come from the vm realm
  // itself — we deliberately do NOT inject host built-ins, whose .constructor
  // would be the host Function (a determinism-guard bypass).
});
const wrapped = `${DETERMINISM_PRELUDE}\n(async () => {\n${body}\n})()`;
await new vm.Script(wrapped, { filename: ... }).runInContext(context);
```

Three defenses are visible in source:

1. `vm.createContext` with **only** the capability-contract globals -- a fresh
   realm, not the host realm.
2. `process` injected as `Object.freeze({ cwd: () => options.cwd ?? process.cwd() })`
   -- a one-method stub, not the real `process`.
3. A `DETERMINISM_PRELUDE` that replaces `Math.random` / `Date.now` / argless
   `new Date()` with throwing stubs in-realm, **plus** a static pre-parse
   blocklist. Their own comment notes `new Date(arg)` still works -- matching
   Claude's rule (argless only) exactly.

## How to Run

```bash
npm install @quintinshaw/pi-dynamic-workflows@3.5.1
node run.mjs                          # sandbox probe
node run.mjs determinism.workflow.js  # expect SCRIPT_VALIDATION_ERROR
```

`probe.workflow.js` and `determinism.workflow.js` are byte-identical to the
copies in `../009-b-script-trust-boundary-nicknisi/`. That is the point: one
fixture, two engines.

Neither fixture calls `agent()`, so no model auth, no subagent spawn, and no
token spend is involved.

## What to Expect

A JSON report of which globals were injected, what the injected `process`
actually carries, and whether a Function compiled inside the realm can reach the
host. The determinism fixture should be rejected before it executes.

## Investigation Trail

1. **Read the vm construction in source first.** `vm.createContext` +
   `runInContext` is a real sandbox; the sibling engine's `runInThisContext` is
   not. Predicted a large privilege gap between the two, then set out to
   measure rather than assert it.
2. **Wrote one Claude-shaped fixture** carrying the upstream contract exactly
   (leading meta declaration, plain-JS body, top-level await, trailing return).
3. **First run failed on a comment.** The fixture's header comment explained
   that clock/RNG access is blocked upstream -- and the engine rejected the
   whole script with `SCRIPT_VALIDATION_ERROR`. `parseWorkflowScript` runs
   `DETERMINISM_BLOCKLIST.test(script)` as a **raw-text regex over source**,
   before acorn ever parses it:

   ```js
   const DETERMINISM_BLOCKLIST = /\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/;
   ```

   A comment naming `Date.now` is indistinguishable from a call. This is a real
   portability hazard, not a harness artifact -- see Results.
4. **Split the fixture in two** so the same probe body could run on both
   engines, with clock/RNG isolated in `determinism.workflow.js`.
5. **Found the first escape probe ambiguous.** `Function('return typeof process')()`
   returned `"object"` -- but that is what a *stubbed* in-realm `process`
   returns too. Replaced it with a discriminator that distinguishes host from
   stub: `process.env` exists on the host, not on the stub.
6. **Probed practical capability**, not just reachability: `process.binding('fs')`,
   `process.binding('spawn_sync')`, `process.mainModule.require`.

## Results

**VERDICT: WINNER of the 009 pair.** The sandbox holds.

### Measured, one identical fixture

| Probe | Result |
| --- | --- |
| `typeof process` | `object` |
| `process` own keys | **`cwd`** (the frozen stub, nothing else) |
| `process.env` type | `undefined` |
| `process.pid` | `undefined` |
| `process.binding` | `undefined` |
| `process.binding('fs')` | **TypeError** |
| `process.binding('spawn_sync')` | **TypeError** |
| `typeof require` | `undefined` |
| `Function('return typeof process.env')()` | `undefined` -- **no escape** |
| `Function('return process.env')()` | `no-env` -- **no escape** |
| realm `globalThis` keys | `agent,parallel,pipeline,workflow,verify,judgePanel` |
| `determinism.workflow.js` | **rejected**, `SCRIPT_VALIDATION_ERROR` |

A Function compiled inside the realm sees the realm's globals, so the classic
`.constructor` escape lands back in the sandbox. The realm's `globalThis`
carries only capability-contract bindings -- no Node globals at all.

### Global injection matches upstream

`agent`, `parallel`, `pipeline`, `phase`, `log` all `function`; `budget` an
object with exactly `total,spent,remaining`; `cwd` a string; `args` `undefined`
when none passed -- which is upstream's documented behavior. `phase()` and
`log()` both return `undefined`.

### The surprise: this inverts the adoption-vs-fit tradeoff

Going in, the framing was "dominant engine, poor structural fit" versus
"marginal engine, exact fit". On the trust axis the dominant engine is also the
**safe** one, and by a wide margin. It is the only one of the two that
approximates Claude's own guarantee, and it enforces the same determinism rule
Claude does -- independently arrived at, for the same stated reason (resume).

### The defect worth carrying forward

The determinism blocklist is a **raw-text regex, not an AST check**. Any script
whose comments or string literals mention `Date.now`, `Math.random`, or
`new Date()` is rejected outright, with a message that describes a rule the
script does not actually violate. A Claude workflow author documenting why they
avoid those calls trips it. Real Claude scripts carry exactly that kind of
explanatory header -- `paperjury/workflows/drafter.workflow.js` from spike 021
opens with 20 lines of prose.

A bridge copying scripts verbatim would surface this as an unexplained install-
or run-time failure. Note this is the **same class** of defect as 009b's
finding 1: both engines preprocess script source with text-level regexes that
cannot tell code from comment.

### Caveats

- `agent()`'s null-vs-throw failure semantics were NOT measured here. Driving
  this engine's `agent()` needs its `WorkflowAgent` plus real spawn machinery,
  which the fixture deliberately avoids. 009b measured it on the sibling engine
  empirically; for this engine the question stays open.
- Measured at 3.5.1 only. The blocklist and the vm construction are both
  implementation details that could change; re-run `run.mjs` against a newer
  version rather than assuming.
