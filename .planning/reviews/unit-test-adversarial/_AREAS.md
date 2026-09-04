# Area partition — adversarial pass dispatch list

45 areas from the first pass. Each has a findings file at
`unit-test-findings/<slug>.md`. The adversarial pass runs one agent per row (or
per sub-row where a split is marked).

Concurrency cap is 20 agents; dispatch in waves and refill as slots free.

## Split these — do NOT give one agent the whole file

The first pass gave each of these a single agent for a 5k–9.4k-line test file.
That is where a stronger model buys the most. Split by the section banners the
test files already carry.

| Slug | Test file | Lines | Suggested split |
| --- | --- | --- | --- |
| `orchestrators-plugin-install` | `tests/orchestrators/plugin/install.test.ts` | 9431 | 3 agents by ledger phase group |
| `orchestrators-plugin-update` | `tests/orchestrators/plugin/update.test.ts` | 8502 | 3 agents: preflight/resolution, swap engine, cascade rendering |
| `orchestrators-plugin-reinstall` | `tests/orchestrators/plugin/reinstall.test.ts` | 7628 | 2 agents; one MUST take the later "coverage gap" section, where the first pass found 3 weak assertions and 3 duplicates |
| `orchestrators-plugin-info` | `tests/orchestrators/plugin/info.test.ts` | 6980 | 3 agents by the file's own section banners |
| `shared-notify` | `tests/shared/notify.test.ts` | 6659 | 3 agents; `notify.ts` is 4039 lines, so each needs a production slice too |
| `architecture-catalog-uat` | `tests/architecture/catalog-uat.test.ts` | 5442 | 2 agents: parser/driver, and the per-command corpus |
| `orchestrators-plugin-list-uninstall` | `list.test.ts` + `uninstall.test.ts` | 8815 | 2 agents, one per file |
| `orchestrators-marketplace-add-update` | `add` + `update` + 2 messaging | 6404 | 2 agents: add-side, update-side |
| `domain-resolver` | `tests/domain/resolver.test.ts` | 3949 | 2 agents; ~136 cases, ~100 under-asserting |

When splitting, give each sub-agent the SAME slug plus a suffix
(`orchestrators-plugin-install-a`, `-b`, `-c`) and tell it which line range or
section it owns. All sub-agents of a slug read the same first-pass findings file.

## Highest-yield targets

Concentrate here if running a subset rather than all 45. These are where the
first pass's blockers cluster, or where its clean verdicts are least trustworthy.

- `orchestrators-plugin-info`, `orchestrators-plugin-list-uninstall`, `orchestrators-marketplace-add-update`, `shared-notify` — the fragment-assertion cluster (~100+ cases)
- `orchestrators-plugin-install`, `orchestrators-plugin-update` — rollback branches proven by state record only
- `bridges-mcp` — first pass found a shipping bug here; look for siblings of it
- `architecture-boundary-gates`, `architecture-hooks-gates`, `architecture-state-drift-gates` — the inert-gate cluster
- `edge-handlers-marketplace`, `edge-handlers-plugin` — the injection-seam severity split
- `platform`, `domain-core` — both judged near-model for the shared-contract pattern; if the pattern is weaker than believed, that changes the reference implementations META-FINDINGS.md recommends

## Areas the first pass reported as clean or near-clean

Attack these hardest. A low finding count is either a healthy area or an
exhausted reviewer, and the first pass cannot tell you which.

`root-index` (0 test findings) · `shared-concerns` (0 findings either section) ·
`bridges-hooks-payloads` (0 blockers) · `orchestrators-plugin-messaging` (0
blockers) · `orchestrators-root` (0 blockers) · `edge-handlers-plugin` (0
blockers) · `bridges-skills` (0 blockers) · `edge-root` (0 blockers) ·
`domain-core` (0 blockers) · `edge-completions` (0 test blockers) ·
`orchestrators-reconcile-apply` (0 test blockers) · `shared-core` (0 test blockers)

## Full slug list

```
architecture-boundary-gates          orchestrators-marketplace-rest
architecture-catalog-uat             orchestrators-plugin-enable-fetch
architecture-hooks-gates             orchestrators-plugin-info
architecture-notify-gates            orchestrators-plugin-install
architecture-state-drift-gates       orchestrators-plugin-list-uninstall
bridges-agents                       orchestrators-plugin-messaging
bridges-commands                     orchestrators-plugin-reinstall
bridges-hooks-adapters-state         orchestrators-plugin-support
bridges-hooks-async-rewake           orchestrators-plugin-update
bridges-hooks-dispatch               orchestrators-reconcile-apply
bridges-hooks-exec-protocol          orchestrators-reconcile-notify
bridges-hooks-if-field               orchestrators-root
bridges-hooks-payloads               persistence
bridges-mcp                          platform
bridges-skills                       root-index
domain-components                    shared-concerns
domain-components-hooks              shared-core
domain-core                          shared-notify
domain-resolver                      transaction
edge-completions
edge-handlers-marketplace
edge-handlers-plugin
edge-handlers-root
edge-root
orchestrators-import
orchestrators-marketplace-add-update
```

## Per-agent prompt template

```
Read `unit-test-findings/_ADVERSARIAL-BRIEF.md` in full FIRST. It defines your
task, the rules to load, the mutation catalogue, the verdict vocabulary, and the
exact output format. Then execute it for this assignment.

SLUG: <slug>
AREA TITLE: <title>
FIRST-PASS FILE: unit-test-findings/<slug>.md
WORKING DIR: /home/acolomba/pi-claude-marketplace-unit-test-refactor
<SECTION: lines N–M / "<banner name>" — only when the slug is split>

Attack that file's `### Clean files` lists first — those are the first pass's
unfalsified negatives and your primary target. Then grade every existing finding
in it. Write `unit-test-findings/adversarial/<slug>.md`.
```

## After all agents finish

1. Run a consolidation agent to merge every `## Meta-findings impact` section from `unit-test-findings/adversarial/*.md` into `META-FINDINGS.md`, honoring corrections and raising confidence on confirmations.
2. Re-run the consistency auditor over the adversarial corpus for a refreshed tally and calibration table. The existing `_AUDIT.md` predates `platform.md`, `transaction.md`, and `root-index.md` and needs that refresh regardless.
3. Still outstanding and not answerable by reading: measure direct per-pair coverage with `npm run test:coverage:direct`. Every coverage claim in the corpus comes from reading, not measurement.
