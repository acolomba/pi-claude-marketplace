# Phase 4 Probe Notes

Date: 2026-10-18
Scope: RM-01 through RM-08 and LS-01 through LS-04.

No SPEC Edge Coverage or Prohibitions section was supplied. The deterministic fallback examined all 12 requirements. Its initial result was 28 applicable items, all unresolved, including two unclassified items. This ledger preserves every item in output order. The planner adds explicit acceptance criteria for 20 items and leaves eight flagged assumptions open. This is planning coverage, not a claim that tests have passed.

## Edge coverage

`explicit` means the cited PLAN must-have truth and task now state the behavior. `flagged assumption` means unresolved and unverified; it is not an accepted product rule, a dismissal, or permission to invent behavior. No item uses a verifier backstop and no item is silently discarded.

| ID | Requirement | Probe category | Planning disposition | Acceptance criterion or flagged assumption |
|---|---|---|---|---|
| E01 | RM-01 | unclassified | flagged assumption | The classifier supplies no concrete additional edge. The source-kind, no-plugin, no-reload requirement is covered by 04-01 task 2, but that does not classify this probe. Retain it for human review. |
| E02 | RM-02 | adjacency | flagged assumption | The probe does not define equal plugin identity across marketplaces or scopes. Existing dependency and cross-scope scenarios remain, but no broader identity-collision behavior is inferred. |
| E03 | RM-02 | empty | explicit | 04-02 truth E03 and task 1 cover one and several installed plugins; 04-01 task 2 covers none. A null inventory is not a public command input. |
| E04 | RM-02 | ordering | explicit | 04-02 truth E04 and task 1 require nonalphabetical installation order for every uninstalled row; 04-04 pins partial-result groups per D-08. |
| E05 | RM-03 | adjacency | explicit | 04-02 truth E05 and task 1 retain the existing same-name cross-scope scenario, including the surviving project plugin's full list result after user removal. |
| E06 | RM-03 | empty | explicit | 04-02 truth E06 and task 2 require an empty skills inventory and empty plugin list in fresh sessions after clean removal. |
| E07 | RM-03 | ordering | flagged assumption | RM-03 specifies absence, not ordering among unrelated surviving plugin-list rows. Do not add an ordering contract for that other command. |
| E08 | RM-04 | unclassified | flagged assumption | The classifier supplies no concrete additional edge. 04-02 task 2 covers clean base-layer persistence and retains the existing local-layer witness; this probe still needs classification. |
| E09 | RM-05 | empty | explicit | 04-01 truth E09 and task 3 cover both explicit scopes when neither scope holds tools and when only the other scope does. The complete wire payload includes the requested scope and the matching reason. |
| E10 | RM-05 | encoding | flagged assumption | Name case folding and Unicode normalization are unspecified by this phase. Fixtures use ordinary distinct ASCII names; no new name-equivalence rule is inferred. |
| E11 | RM-06 | empty | explicit | 04-01 truth E11 and task 3 cover bare absence with the complete standalone result and no scope field. |
| E12 | RM-06 | encoding | flagged assumption | The same unresolved name-equivalence issue as E10 applies to unscoped absence. |
| E13 | RM-07 | idempotency | explicit | 04-01 truth E13 and task 3 invoke rm after a successful removal. The second call reports the scoped miss with no reload and leaves the control declaration intact. |
| E14 | RM-07 | concurrency | flagged assumption | Interrupting or parallelizing rm is not defined in these acceptance sources. Existing recovery/locking constraints still apply, but this plan does not claim a new public concurrent-command witness. |
| E15 | RM-08 | empty | explicit | 04-01 truth E15 and task 3 cover no match, sole-user fallback, both-scope selection, and project-local-only refusal before user-base fallback. |
| E16 | RM-08 | encoding | flagged assumption | Equality is tested with exactly identical ordinary names. Case/Unicode-equivalent names remain unspecified, as in E10. |
| E17 | LS-01 | adjacency | explicit | 04-03 truth E17 and task 1 distinguish the two tools rows in populated controls by scope; equal names never imply an empty list or one merged row. |
| E18 | LS-01 | empty | explicit | 04-03 truth E18 and task 1 retain the exact empty inventory result. |
| E19 | LS-01 | ordering | explicit | 04-03 truth E19 and task 1 require exactly zero rows and no populated-list tally for an empty inventory; there are no equal rows to reorder. |
| E20 | LS-02 | adjacency | explicit | 04-03 truth E20 and task 1 require both tools rows with their own scope and autoupdate values. |
| E21 | LS-02 | empty | explicit | 04-03 truth E21 and task 1 cover a singleton inventory with a local autoupdate override, alongside the empty seed and six-row inventory. |
| E22 | LS-02 | ordering | explicit | 04-03 truth E22 and task 1 require project zulu/yankee/tools before user bravo/alpha/tools in insertion order. |
| E23 | LS-03 | adjacency | explicit | 04-03 truth E23 and task 2 retain only the selected tools row when both scopes hold the same name. |
| E24 | LS-03 | empty | explicit | 04-03 truth E24 and task 2 cover each empty selected scope while the other scope is populated. |
| E25 | LS-03 | ordering | explicit | 04-03 truth E25 and task 2 require the selected scope's complete insertion-ordered three-row inventory. |
| E26 | LS-04 | adjacency | explicit | 04-03 truth E26 and task 2 require both tools rows through ls. |
| E27 | LS-04 | empty | explicit | 04-03 truth E27 and task 2 require the exact empty ls result. |
| E28 | LS-04 | ordering | explicit | 04-03 truth E28 and task 2 require the same six-row order through ls as through list. |

Planning totals: applicable 28; explicit 20; backstop 0; unresolved 8; unclassified 2. The unclassified count is a subset of unresolved. The eight flagged assumptions are E01, E02, E07, E08, E10, E12, E14, and E16. Source requirements remain fully planned; these flags do not redefine their scope.

## Prohibition recall: stage 1

The adversarial question was applied separately to every requirement: what implementation could satisfy the positive sentence while harming user intent? The table retains ten raw candidates for each requirement. The stage-2 codes are attached to make every precision decision inspectable.

`R` = routine positive-contract correctness, already handled by ordinary acceptance criteria rather than a new values prohibition. `C` = canonical security/compliance concern, referred to the phase threat model and the project's security review; it is not minted as a bespoke prohibition. Neither code is an edge-probe auto-dismissal.

| Requirement | Raw adversarial candidates, with stage-2 classification |
|---|---|
| RM-01 | 1 R remove the wrong scope; 2 R remove the wrong layer; 3 R remove an unrelated declaration; 4 R retain the requested declaration; 5 R invent plugin rows; 6 R request an unnecessary reload; 7 R hide a failed removal; 8 C allow fixture path escape; 9 C contact an unapproved public fixture host; 10 C leak credentials in the result. |
| RM-02 | 1 R skip an installed plugin; 2 R duplicate an uninstalled row; 3 R alphabetize execution results; 4 R stop after the first per-plugin failure; 5 R erase a failed plugin record; 6 R retain a successful plugin record; 7 R interleave success and failure groups; 8 R remove the marketplace after partial failure; 9 C write beyond the owned scope; 10 C disclose secrets in a cause. |
| RM-03 | 1 R leave a removed skill available; 2 R leave a removed plugin listed; 3 R clear unrelated plugin records; 4 R erase the other scope's same-name plugin; 5 R rely on one process's stale memory; 6 R require a process restart instead of reload; 7 R claim partial removal persists despite retained declarations; 8 R test only one of skills and list; 9 C expose another user's files; 10 C run uncontrolled fixture code. |
| RM-04 | 1 R delete only an in-memory record; 2 R retain the cleanly removed declaration; 3 R recreate the cleanly removed marketplace next session; 4 R clear unrelated declarations; 5 R observe only the old session; 6 R remove the wrong local/base layer; 7 R claim partial-failure cross-session persistence; 8 R ignore the new session's failed startup; 9 C write outside the sandbox; 10 C fetch remote fixture content during a local test. |
| RM-05 | 1 R remove the other scope as fallback; 2 R report the other scope instead of the requested one; 3 R drop the explicit scope field; 4 R add a false elsewhere-present reason; 5 R emit a successful removal row; 6 R request reload on a miss; 7 R alter declarations on failure; 8 R compare only a result subset; 9 C leak credentials from an arbitrary name; 10 C accept a path-escape name. |
| RM-06 | 1 R invent a requested scope; 2 R produce a cascade instead of the standalone miss; 3 R report success; 4 R request reload; 5 R clear an unrelated marketplace; 6 R return a blank scope instead of omitting it; 7 R omit the generic reason; 8 R synthesize a marketplace row; 9 C reveal another user's inventory; 10 C disclose secrets in error text. |
| RM-07 | 1 R parse rm without performing removal; 2 R select a different scope than remove; 3 R select a different layer; 4 R emit a different result shape; 5 R leave declarations behind; 6 R ignore installed plugins; 7 R request reload on repeated absence; 8 R delete the surviving control on retry; 9 C bypass the command's authorization boundary; 10 C write outside the scope root. |
| RM-08 | 1 R remove both scopes; 2 R select user before project; 3 R report an unchanged user row; 4 R warn about the untouched user copy; 5 R fall through from project-local-only to user base; 6 R refuse sole-user fallback; 7 R leave the project declaration after success; 8 R pin an unrecorded upstream divergence; 9 C cross another user's filesystem boundary; 10 C disclose private configuration paths. |
| LS-01 | 1 R invent a default marketplace; 2 R emit a populated-list tally; 3 R hide an existing row; 4 R treat duplicate names as no rows; 5 R report error for a valid empty list; 6 R request reload; 7 R mutate config while listing; 8 R compare only a row count; 9 C contact a public host; 10 C disclose unrelated user data. |
| LS-02 | 1 R merge equal names across scopes; 2 R omit a scope; 3 R put user rows first; 4 R alphabetize within a scope; 5 R sort the observation in the test; 6 R show the wrong autoupdate value; 7 R ignore a local override; 8 R accept a missing or stale last-updated field; 9 C leak credentials in source metadata; 10 C fetch remote content during list. |
| LS-03 | 1 R include the other scope; 2 R select the wrong same-name row; 3 R reorder selected rows; 4 R return all scopes when selected scope is empty; 5 R omit a selected row; 6 R retain the unfiltered tally; 7 R mutate the unselected config; 8 R request reload for filtering; 9 C reveal another user's records; 10 C trigger unnecessary network access. |
| LS-04 | 1 R parse ls without listing; 2 R omit duplicate names; 3 R reorder populated output; 4 R differ on empty output; 5 R lose autoupdate details; 6 R lose timestamps; 7 R emit a different tally; 8 R mutate records through the alias; 9 C bypass output redaction; 10 C initiate a network request. |

## Prohibition precision: stage 2

All 120 candidates were classified. Ninety-five are ordinary behavioral correctness and are handled by the source acceptance criteria. Twenty-five are canonical security/privacy/containment candidates; they are breadcrumbs for the existing security and static-analysis process. None introduces a distinct, evidence-backed domain values commitment beyond the locked source contracts. Therefore there is no kept inferred prohibition, and each plan emits `must_haves.prohibitions: []`.

Security breadcrumbs: keep the scope-isolation, fixture-containment, output-contract, and dependency gates in T-04-01 through T-04-10 and T-04-SC; let the phase security review evaluate those concrete boundaries. Do not create new telemetry, authorization, normalization, consent, or remote-service behavior to satisfy this recall exercise. If the user later adopts a bespoke prohibition, record it as flagged and unverified without a fabricated verifier descriptor until the required evidence exists.
