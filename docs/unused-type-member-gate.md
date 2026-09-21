# Unused type member gate

Fails any TypeScript interface or object-type member that no run-time read ever observes.

A declaration is not a read. A type-only reference is not a read. A member spelled the same way on an unrelated type is not a read. So a slot that every caller fills and nobody ever looks at fails this gate, even though the compiler, the linter and the dead-code analysis all accept it.

The gate is part of `npm run check` and runs as a pre-commit hook. This document states what it measures, what it deliberately does not claim, how to answer a finding, and the one form a standing finding may take.

## Invocation

| Command                                             | What it runs                                            | Cost                                                         |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run lint:type-members`                         | The gate over the whole project                         | one whole-program analysis, about 85 seconds                 |
| `npm run lint:type-members:negative`                | The sensitivity controls around the gate                | five whole-program analyses, about seven minutes and 2.1 GiB |
| `npm run lint:type-members:audit`                   | Reconciles the recorded population against the live one | one whole-program analysis                                   |
| `node scripts/check-unused-type-members.mjs --help` | The claims the gate makes, printed                      | none                                                         |

`npm run check` runs the gate and the sensitivity controls, in that order, at the end of the chain. Continuous integration runs `npm run check`, so its invocation is the same one you run locally and can never be weaker.

Two pre-commit hooks invoke the same two scripts. Both set `pass_filenames: false`, because the analysis is whole-program: the change the gate exists to catch is the removal of the sole reader of a member declared in a *different* file, and a per-file invocation would never see it.

The two hooks have different triggers, deliberately.

- `npm-type-members` runs on any change that can alter what the gate reports: production and test `.ts`, the analyzer scripts, the contract and decision records, `tsconfig.json`, the dependency manifests and the hook configuration itself.
- `npm-type-members-negative` runs only on the gate's own machinery, plus the declaration the controls plant into. Whether the gate can still see an offender is settled by the analyzer and its records, never by an ordinary edit under `extensions/`, so the seven minutes do not ride on every source commit. The controls still run in full on every `npm run check`, local and CI alike.

`tests/architecture/unused-type-member-gate.test.ts` asserts both triggers by exercising them against sample paths, so widening or narrowing either one is a change you have to make there on purpose.

## Exit status

| Status | Meaning                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | No outstanding findings. Members a recorded decision accepts are printed but do not fail the run.                                                          |
| 1      | One or more members are unread or unsupported, and no recorded decision accepts them.                                                                      |
| 2      | The run could not be completed: a missing `tsconfig.json`, unparsable source, a bad option, an exhausted budget, or an invalid contract or decision entry. |

Keeping status 2 separate is the point of the design. A run the gate could not finish must never read as a clean tree, so a refusal writes no report at all and names what it could not read.

## What counts as a read

The gate reports that some run-time syntax *could* read a declared member. It observes:

- property access and optional-chain access;
- element access under a literal key, or under a finite union of literal keys;
- binding destructuring (through renames, defaults and nesting) and assignment destructuring;
- compound assignment and update expressions, which read the old value before writing;
- exact `in` presence tests, recorded as a presence observation rather than a value read.

It also settles whole-object operations, which read a shape all at once. These are resolved through the declaration the type checker resolved, never through the callee's spelling:

- JSON serialization;
- object spread and rest;
- `Object.assign`, which reads its sources and not the target it writes into;
- `Object.values` and `Object.entries`, but not `Object.keys`, which enumerates names and reads no value;
- Node's deep comparisons.

A local function earns the same summary only by passing one of its own parameters into one of those operations.

Declarations, type-only references (`keyof`, indexed-access types, type queries), object initializers and bare key enumeration are not reads.

## Production and test reads are separate observations

Every candidate member lands in exactly one of five states.

| State                  | Meaning                                              | Fails the gate |
| ---------------------- | ---------------------------------------------------- | -------------- |
| `runtime-observed`     | At least one production read                         | no             |
| `test-only-observed`   | Read only from `tests/`                              | no             |
| `explicit-contract`    | No read, and a validated contract entry explains why | no             |
| `unread`               | No read anywhere                                     | yes            |
| `unsupported-analysis` | The analyzer could not decide                        | yes            |

A deep comparison credits only the operand whose value came out of production code, so a fixture a test wrote for itself proves nothing about the production type.

`test-only-observed` does not fail the gate, but it is not a clean bill of health either. It says the only thing that ever looks at this member is a test, which is often the signal that a production consumer was removed and its assertion was left behind. `node scripts/check-unused-type-members.audit.mjs --inventory` records every one of them, with its witnesses, so the population stays visible rather than merely not failing.

## What a clean result does not mean

This is a bounded may-observe analysis, and the limits below are load-bearing.

A clean result does **not** establish that:

- the reading branch ever executes;
- the value read influences any behaviour;
- an asserting test is a useful test;
- the member is worth keeping.

One property access in one unreachable branch is enough to credit a member here. Coverage, dead-code analysis and assertion review remain necessary, and none of them is replaced by a green run of this gate. Treat the gate as a floor, not a verdict.

The analysis also refuses to guess. Own-property eligibility is refused where an accessor or a class instance makes it unprovable, and a run-time replacer function or a `toJSON` member leaves the serialized keys unresolved. Each refusal is reported as `unsupported-analysis` with a named reason, and an `unsupported-analysis` finding fails the gate exactly like an unread one.

## Contracts: evidence the engine proves

`scripts/check-unused-type-members.contracts.json` records members that no read observes but that the type system compels. Each entry carries a category, and each category is a claim the contract engine proves against the real tree rather than accepting on trust. If the engine cannot prove an entry, the run refuses with status 2 and names the entry; an invalid entry is never a quiet allowance.

| Category               | What the entry claims, and what the engine checks                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type-selection`       | A named filter expression selects a variant group out of a union by this discriminant. The engine requires the selected-over type to be a union that actually discriminates on the key. |
| `type-refinement`      | A restatement narrows a slot an operand already declares. The engine refuses a restatement that *adds* a key rather than narrowing one.                                                 |
| `nominal-brand`        | The member exists to make a type nominal, so nothing may read it by design.                                                                                                             |
| `external-input`       | An installed third-party declaration *requires* this slot, and a named site hands the local mirror to it.                                                                               |
| `external-mirror`      | An installed third-party declaration *offers* this slot optionally, and a named site checks the local mirror against it, so widening it would fail the build.                           |
| `external-output`      | The value crosses a named trust boundary and is read outside this program.                                                                                                              |
| `conditional-clause`   | A named conditional type reads the slot.                                                                                                                                                |
| `satisfies-constraint` | A named `satisfies` expression constrains the slot.                                                                                                                                     |
| `schema-pin`           | A named schema pins the slot's shape.                                                                                                                                                   |

A contract is not a way to silence a finding you disagree with. If the engine refuses your draft, the correct response is to withdraw the draft, not to reshape the product type until the prover accepts it.

### Contract coordinate drift

Every entry is anchored to an exact `path:line:column`. An entry whose coordinates no longer resolve makes the run refuse with status 2 *before* any member verdict is reached, naming the entry. That is the intended behaviour: a contract that silently re-anchored onto whatever moved into those coordinates would excuse the wrong member.

So any edit above a contracted declaration moves its coordinates, and the entry has to be re-derived from the current source in the same change. Re-derive it by running the gate and reading the reported identity; do not transcribe coordinates from an older record.

**The peer-upgrade edge.** Three entries resolve an `upstream` coordinate inside `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.

They are the two `external-input` entries and the one `external-mirror` entry on `platform/pi-api.ts`, which mirror the `resources_discover` event and result declarations. Upgrading the `@earendil-works/pi-coding-agent` peer moves those lines. The gate then refuses all three by name with status 2, which fails safe but looks alarming if you were not expecting it. The fix is to open the new `types.d.ts`, find the same three slots, and update the `upstream` coordinates in the same commit as the upgrade. If a slot is gone upstream, the local mirror is what needs the change, not the entry.

## Recorded decisions: the only sanctioned residual form

Some members are unread and stay unread on purpose. `scripts/check-unused-type-members.exceptions.json` is where those live, and it is the **only** residual form this gate accepts.

There is no exclusion list, no path pattern, no count threshold and no baseline allowance. None of them can be written down: the identity field admits no pattern character, and any field outside the five below is refused outright, so `maximumUnread: 6` is a status-2 setup failure rather than a configuration option.

An entry carries exactly five fields.

| Field       | What it must be                                                            |
| ----------- | -------------------------------------------------------------------------- |
| `id`        | One exact member coordinate, `path:line:column`, with no pattern character |
| `owner`     | The declaring type or value, exactly as the gate reports it                |
| `key`       | The member name, exactly as the gate reports it                            |
| `decision`  | Where the decision that accepted this row is recorded                      |
| `mechanism` | What was tried and what was observed, at least 120 characters              |

Four rules keep the list from becoming a mute button.

1. **An entry that matches no reported finding refuses the run.** If the member was repaired, the entry has to go with it. If its coordinates drifted, the entry has to be re-derived. A repaired member cannot leave a silent allowance behind.
2. **An entry whose coordinates match but whose `owner` or `key` does not is refused.** Identity is the triple, not the location.
3. **An `unsupported-analysis` finding can never be excused.** That status is the analyzer reporting that it could not decide, and a decision cannot stand in for an analysis nobody made.
4. **Every excused member is printed on every run**, passing or failing alike, with the decision that accepted it. A residual nobody is shown is a residual nobody revisits.

The excused members stay in the report and in the recorded population. `npm run lint:type-members:audit` still counts them as unread, and the live record still lists them. A recorded decision changes the exit status and nothing else.

**Adding a row is a decision, not maintenance.** The bar is a measured mechanism: something you tried, with the result you observed, that explains why no category reaches this member and why repairing it would be wrong. "Intentional" is not a mechanism, and the 120-character floor exists so it cannot be written as one. If you find yourself adding a row to get a commit through, the row does not belong there.

## Answering a finding

Work down this list. The first answer that is true is the one to take.

1. **Delete the member.** Nothing reads it. This is the right answer far more often than it feels like it should be.
2. **Wire the reader.** The member exists because a consumer was planned or removed. Add or restore the consumer.
3. **Collapse a duplicate declaration.** Two structurally identical shapes across an architecture boundary mean production reads land on one of them and the other looks unread. Make one an alias of the other, in the direction the boundary rules already permit, and keep both published names.
4. **Record a contract.** The type system compels the member. Pick the category that states *why*, and let the engine prove it.
5. **Record a decision.** None of the above is true, and removing the member would be wrong. This is the last resort, and it is a decision someone has to make and write down.

What is not on the list: adding a read that exists only to satisfy the gate, adding a `fallow-ignore`, weakening a refusal marker so the prover accepts it, or excluding a file. Each of those trades a reported finding for an unreported one, which is the exact failure this gate exists to prevent.

## The sensitivity controls

A gate is only worth its exit status if it can still fail. `scripts/check-unused-type-members.negative.mjs` proves this one can, by planting a real offender into a real declaration and requiring the gate to report it.

The plant procedure, which is what makes the proof mean something:

1. The runner reads `extensions/pi-claude-marketplace/edge/types.ts` and resolves the real `EdgeDeps` interface **through the TypeScript parser**, not by matching source text, so the insertion point follows the declaration's structure rather than its formatting.
2. It inserts `readonly neverReadAnywhere?: string;` after the interface's last member. A synthetic lookalike would prove the analyzer can see a fixture; only the real declaration proves it can see this tree.
3. The expected declaration identity -- path, line and column -- is **counted out of the overlay text by string arithmetic**. Nothing in the expectation comes back from the analyzer, which is the difference between a control and an echo.
4. The overlay is applied as a compiler *read override*. No project file is ever written, and the runner reads both overlay targets back after a pass and after a failure to prove it.

Seven controls run against the real repository:

| Control                        | What it proves                                                              |
| ------------------------------ | --------------------------------------------------------------------------- |
| `baseline`                     | The tree does not already report the planted member                         |
| `offender-plant`               | The gate reports the plant by exact identity, over and above the baseline   |
| `benign-receiver-read`         | A real read from a real receiver clears exactly that finding                |
| `unrelated-same-spelling-read` | A same-spelling member on an unrelated type does **not** clear the offender |
| `plant-removed`                | The report returns to the baseline once the overlay is gone                 |
| `compiler-failure`             | Unparsable input exits 2 with no report, naming the file                    |
| `option-failure`               | A bad option exits 2 with no report, naming the option                      |

`offender-plant` is the control an always-passing gate fails.

`--gate <path>` points the controls at any executable. `tests/scripts/check-unused-type-members.negative.test.ts` uses it to drive deliberately defective gates -- one that always reports a clean tree, one that always reports the same findings, one that describes a different member at the planted coordinates, one whose report cannot be parsed, one that answers a refusal where a member finding belongs, and the reverse -- and requires the runner to reject each of them. A runner that cannot fail proves nothing about the runner that can.

Two things the controls cannot see from inside themselves are checked in `tests/architecture/unused-type-member-gate.test.ts`: that the planted key is absent from the real declaration (a plant that collides with a real member stops being a plant without any case going red), and that every capability the help text claims is bound to a named control (a claim whose control was renamed away is a promise nothing keeps).

**A live run and concurrent editing do not mix.** The runner analyses the tree as it is on disk at the moment each child process starts, and it takes minutes. Editing `edge/types.ts` or `tests/edge/types.test.ts` while it is in flight fails the containment check.

## Files

| Path                                                | Role                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/check-unused-type-members.mjs`             | Command-line entry point; owns the exit status and applies recorded decisions |
| `scripts/check-unused-type-members.analysis.mjs`    | Drives the walk and assembles the report                                      |
| `scripts/check-unused-type-members.model.mjs`       | Candidate enumeration and the read forms                                      |
| `scripts/check-unused-type-members.flow.mjs`        | Value transfer between declarations                                           |
| `scripts/check-unused-type-members.operations.mjs`  | Whole-object operations                                                       |
| `scripts/check-unused-type-members.contracts.mjs`   | The contract categories and their proofs                                      |
| `scripts/check-unused-type-members.contracts.json`  | The evidence-backed exceptions                                                |
| `scripts/check-unused-type-members.exceptions.mjs`  | The recorded-decision loader and its refusals                                 |
| `scripts/check-unused-type-members.exceptions.json` | The recorded decisions                                                        |
| `scripts/check-unused-type-members.negative.mjs`    | The executable sensitivity controls                                           |
| `scripts/check-unused-type-members.audit.mjs`       | Records and reconciles the live population                                    |
