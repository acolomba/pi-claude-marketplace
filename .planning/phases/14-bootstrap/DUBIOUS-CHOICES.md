# Phase 14 (Bootstrap): Dubious Choices

The choices Phase 14 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 14.
Only the Phase 14 child session writes this file: it copies each item from
the report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md`.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 14's.

## Discuss step

The autonomous run took the recommended option at every discuss question. Those answers are the decisions D-BG-1401 to D-BG-1410 in 14-CONTEXT.md, so this log does not repeat them, except for the three that a reviewer may want to reverse.

- **P14-DC-01 (Medium, open). No terminal scenario for the lock-held failure (D-BG-1404).** Criterion 2 compares the terminal with json and RPC. The lock-held notice wraps its cause line at the real sandbox path, and that path's length depends on the host's temporary directory. So only the added and refused outcomes are compared in the terminal. The lock-held outcome is compared over RPC and in json mode.
- **P14-DC-02 (Medium, open). The lock-held row names the source, not the marketplace (D-BG-1406).** The failed row reads `anthropics/claude-plugins-official` where the manifest name is `claude-plugins-official`. This is `marketplace add`'s row for a GitHub source it could not add, and MOD-01 makes it bootstrap's contract. The existing 404 scenario pins the same shape. The phase pins it and does not change it.
- **P14-DC-03 (Low, open). No verb module (D-BG-1408).** The ownership table lists a NEW `plugin/bootstrap.steps.ts` for Phase 14. Every step that the scenarios need already exists, so the module is created only if planning or execution finds a missing step.
