# Phase 14: Bootstrap - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

`plugin/bootstrap.feature` pins three things about `/claude:plugin bootstrap`:

1. It refuses `--scope` and any argument with its usage, and changes nothing (BOOT-01, criterion 1).
2. A run in json mode and a run over RPC carry the same outcome as the same run in the terminal (BOOT-01, criterion 2).
3. A run while another process holds the user scope's state lock fails as lock held, and adds and records nothing (BOOT-02, criterion 3).

The phase adds coverage. It changes product code only if a scenario exposes a bug. The fix then goes in `orchestrators/plugin/bootstrap.ts` or `edge/handlers/plugin/bootstrap.ts`, with their unit pairs.

Upstream: Claude Code has no `bootstrap` command. The 2.1.319 binary has no `plugin bootstrap` string. Its built-in official marketplace is `anthropics/claude-plugins-official` on GitHub, the source that bootstrap adds. So no upstream contract applies to this command. Bootstrap's contract is this extension's `marketplace add` for the same source (MOD-01 in the `orchestrators/plugin/bootstrap.ts` header). Bootstrap renders exactly the bytes that `marketplace add` renders. The ROADMAP sets "Research flag: no".

</domain>

<decisions>
## Implementation Decisions

The parent probed today's behavior on the phase head (`7e961d04`) with a scratch feature file, then deleted it. A copy is at `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/zz-probe14.feature`. Every expectation below passed under the `adapter` profile, so the phase expects no product bug.

### Refusals (BOOT-01, criterion 1)

- **D-BG-1401: the existing outline stays the refusal matrix.** "Bootstrap rejects <rejected> with its usage" already pins every refusal that the criterion names: a positional argument, an unknown flag, `--local`, `--scope user`, `--scope project`, a bad scope value, and `--scope` with no value. The phase adds no new refusal row.
- **D-BG-1402: the outline also proves that a refusal changes nothing.** The outline gains `Given the marketplace "claude-plugins-official" is published as the official marketplace`, so a bootstrap that did not refuse would add it. After the usage-error fields, every example asserts these:
  - `Then the "claude-plugins.json" file of the user scope does not exist`
  - `Then the "claude-plugins.json" file of the project scope does not exist`
  - `Then the user scope holds no git clones`
  - `Then the git host receives no request`

  The red proof is a temporary product mutation, never committed, that lets a refused flag through to the add. With it, the add runs and these steps fail.

### Output modes (BOOT-01, criterion 2)

- **D-BG-1403: each outcome is compared in each mode that renders it reliably.**
  - *Added:* the seeds and the first scenario already cover RPC, json mode, and the terminal (`● claude-plugins-official [user] (added)`). They stay as they are.
  - *Refused:* new scenarios run the `--scope user` refusal in json mode and in the terminal. The json scenario uses the same `Then the result has these fields:` table as the RPC outline row. The terminal scenario expects this whole notice:
    ```text
    Error: bootstrap does not accept --scope; it always targets user scope.

    Usage: /claude:plugin bootstrap
    ```
  - *Lock held:* a new scenario runs the lock-held failure in json mode, with the same rows as the RPC scenario of D-BG-1405.
- **D-BG-1404: no terminal scenario for the lock-held failure.** Pi wraps the cause line of the lock-held notice at the terminal width. That line holds the real sandbox path (`/tmp/pi-cm-features-XXXXXX/agent/...`), so the place where a line breaks depends on the length of the temporary directory path. Run tokens are applied after the wrap, so the expected literal would hold `{agent dir}` in the middle of a wrapped line, and a CI host with another temporary directory would break it. The json-mode scenario and the RPC scenario compare the same outcome. See P14-DC-01.

### State lock (BOOT-02, criterion 3)

- **D-BG-1405: one RPC scenario for a first bootstrap while the user scope's lock is held.** It has `Given the marketplace "claude-plugins-official" is published as the official marketplace` and `Given another process holds the state lock of the user scope`, then `When the user runs "/claude:plugin bootstrap"`. It asserts these, which the probe confirmed:
  - The command reports one result: `cascade`, `error`, needs reload `false`, summary `Some operations have failed.`
  - The result lists one plugin row. The marketplace name is `anthropics/claude-plugins-official`, its scope `user`, and its status `failed`. The id and name are `anthropics/claude-plugins-official`, the status `failed`, the reason `lock held`, and the scope `user`. The cause chain is `Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held`. Cause truncated is `false`, and leaks and rollback partial are empty.
  - The user scope's `claude-plugins.json` does not exist, the user scope holds no marketplace checkout and no git clones, and the git host receives no request. The add takes the lock before it clones.
- **D-BG-1406: the row names the source, as `marketplace add` does.** The failed row names `anthropics/claude-plugins-official`, the typed source, and not the manifest name `claude-plugins-official`. This is `marketplace add`'s row for a GitHub source it could not add: `marketplace/state-lock.feature` pins it for `acme/tools`, and bootstrap's own 404 scenario pins the same shape. MOD-01 makes bootstrap's bytes `marketplace add`'s bytes, so this row is the contract, not a bug. See P14-DC-02.
- **D-BG-1407: the lock-held red proof is a temporary product mutation, never committed.** One example: a local edit that makes the add ignore a held lock. With it, the scenario sees an `(added)` row, a declared marketplace, and git requests. Afterwards the executor restores the file with `git checkout -- <file>` and records the proof in the SUMMARY. A frozen file such as `transaction/with-state-guard.ts` may be mutated only for that local proof. It is never staged.

### Files, tags, and plan shape

- **D-BG-1408: no verb module unless a step is missing.** Every step that the new scenarios need already exists in a shared or topic module: `command.steps.ts`, `config.steps.ts`, `scope-state.steps.ts`, `git-host.steps.ts`, and `marketplace/publishing.steps.ts`. The ownership table reserves `plugin/bootstrap.steps.ts` for this phase but does not require it. The planner creates it only for a step that no module has. See P14-DC-03.
- **D-BG-1409: no implementation tags.** Bootstrap has no MCP surface, so every scenario runs once, under the `adapter` profile (D-BG-04). The seeds keep their titles and steps, so each of their steps stays in use.
- **D-BG-1410: one plan, one wave.** Every change is in one file, `features/plugin/bootstrap.feature`, plus the phase records. Several plans in one wave would edit the same file, so one plan does all the work.

### Claude's Discretion

- The order of the scenarios and their titles in `bootstrap.feature` follow the existing title style ("Bootstrapping …", "A bootstrap …").
- Whether the RPC lock-held scenario and the json-mode one are two scenarios or an outline over the `When` form. Two plain scenarios are expected, because the two `When` steps are different steps.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `command.steps.ts`:
  - `the user runs {string}` (RPC)
  - `the user runs {string} in pi's json mode`
  - `the user runs {string} in pi's terminal`
  - `pi's terminal shows this result of the command:`
  - `the command reports these results:`
  - `the result has these fields:`
  - `the result lists these plugins:`
  - `the results list these marketplaces and plugins:`
- `scope-state.steps.ts`: `another process holds the state lock of the {word} scope`, which runs a helper process (`features/lib/state-lock-holder.ts`), and `the {word} scope holds no git clones`.
- `config.steps.ts`: `the {string} file of the {word} scope does not exist`.
- `git-host.steps.ts`: `the git host receives no request`.
- `marketplace/publishing.steps.ts`: `the marketplace {string} is published as the official marketplace`.

### Established Patterns

- Lock-held scenarios in `marketplace/state-lock.feature` and `plugin/state-lock.feature` use the same cause chain and the `{agent dir}` and `{project dir}` tokens.
- The usage-error result has the fields `kind`, `severity`, `needs reload`, `message`, and `usage`. The terminal renders it as `Error: <message>`, a blank line, then the usage.

### Integration Points

- `edge/handlers/plugin/bootstrap.ts` parses and refuses the arguments. `orchestrators/plugin/bootstrap.ts` composes `addMarketplace` with scope `user` and the source `anthropics/claude-plugins-official`. The lock is `withLockedStateTransaction` inside the add.

</code_context>

<specifics>
## Specific Ideas

- The json-mode one-shot Pi with a held lock emits only the command's result, with no extra load notice. The probe's `the command reports these results:` table had exactly one row.

</specifics>

<deferred>
## Deferred Ideas

- A bootstrap re-run while the lock is held, over an official marketplace that is already recorded. The record would stay unchanged. Criterion 3 names the first-run case, so this case is not pinned.
- A lock that a dead process left, during bootstrap. That is MLOCK-02 territory (Phase 15, marketplace verbs).

</deferred>
