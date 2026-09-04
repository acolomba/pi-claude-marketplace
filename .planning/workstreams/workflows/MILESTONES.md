# Milestones

## workflows Claude workflows Component-Kind Bridge (Shipped: 2026-08-16)

**Phases completed:** 5 phases, 20 plans, 39 tasks

**Key accomplishments:**

- `workflows` admitted to both resolver tuples on the convention axis as well as the manifest axis, with a required `componentPaths.workflows` member and a `workflows:` line on `/claude:plugin info`
- Twelve cases across both resolution modes pin the `workflows` admission matrix the shared collector delivers for free — declared forms, union order, dedup comparator, silent absent path, containment parity, and the loose-mode negative
- A rendered `workflows:` line is now under the project's binding byte-equality contract, landed with its paired fixture in one commit, and every surviving `info` prose statement of the render order names all six kinds
- The two behaviors that shift as a consequence of admitting `workflows` -- the reconcile self-heal and the disabled-record pin refresh -- are pinned as intended, one-time, and non-materializing, with no production file edited
- A workflow script now names its own command: acorn parses the source, `meta.name` is read off the AST, and `generatedWorkflowName` joins it to the plugin under both the RN-2 rules and the host engine's length and trim rules.
- Every non-admitted shape now has its own verdict: an unreadable name is skipped, a broken or nondeterministic script is refused by file with the real reason, and two scripts claiming one command name fail loudly instead of one silently winning.
- The home-directory seam.
- The parity suite.
- The soft-fail warnings.
- One stem rule, exported.
- Extracted the hermetic workflow-home double into `tests/helpers/workflow-home.ts` and taught `update.test.ts`'s fixture builders to name individual workflow scripts, so the rest of the phase can write its assertions without duplicating a function ESLint forbids duplicating.
- `cascadeUnstagePlugin` now calls six bridges instead of five, so `uninstall`, `disable` and `marketplace remove --cascade` physically remove the workflow envelopes they used to orphan — and a removal that fails reports per-name reasons through a typed error instead of vanishing.
- `previousWorkflowNames` finally has a production supplier, so the bridge's re-stage branch runs for the first time — and in the same commit a workflow commit stopped renaming over content the plugin does not own.
- `update` now prepares, aborts, commits and records workflows as a sixth bridge, so an author's workflow fix reaches the user and a withdrawn workflow stops running — and the closed phase set turned out to have three mirrors, not two.
- Reinstall now re-materializes workflow envelopes from the plugin source and records the names it actually wrote, and the commit-in-place choice is documented as a decision with its residual window named rather than left to be read as an oversight.
- A removal that took a workflow now says so on its own row -- the removed command stays registered and runnable until reload, because the host exposes no unregister call -- and it says so only when a workflow was actually removed.
- The host workflow engine becomes the third soft dependency: probed by its distinctive `workflow_control` tool, marked as `requires pi-dynamic-workflows` on the install / update / reinstall / enable rows, and byte-pinned in two new catalog states — while the envelopes are still written and the install still succeeds.
- Every surface that can render a soft-dependency marker now renders the host-engine one, and a gate — not a grep — is what says so: reverting any one of the seven `Dependency[]` derivations turns exactly one case red.
- "The artifacts do not depend on the probe" stops being a claim: two installs differing only in the session's tool list now write the same envelope bytes, the workflows bridge is structurally forbidden from naming a probe symbol, and the live canary carries an assertion that a real engine finds an envelope installed without it.
- The contract of the one bridge that installs executable code is now written down: which engine runs a third party's JavaScript, how tightly that engine is sandboxed against the alternative it was chosen over, which script shapes install and then refuse to run, and which of those claims were measured versus read.

---
