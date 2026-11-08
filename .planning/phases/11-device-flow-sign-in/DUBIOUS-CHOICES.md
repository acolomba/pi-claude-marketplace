# Phase 11 (Device Flow Sign-In): Dubious Choices

The choices Phase 11 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 11.
Only this phase's session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md`.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 11's.

## Discuss step

The autonomous run took the recommended option at every discuss question;
those answers are the decisions D-BG-1101 to D-BG-1106 in 11-CONTEXT.md, so
they are not repeated here.

- **P11-DC-01 (Medium, open). No upstream sign-in to compare.** Claude Code
  runs no Device Flow: it clones with the system git and the user's credential
  helpers, and turns git's prompts off where no terminal exists
  (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, read from the 2.1.319
  binary). The scenarios therefore pin the project's own contract (AUTH-01,
  D-79-04, D-79-05, GHB-02) as the product renders it, and use Claude Code as
  the reference only for DFLOW-04 (a background pass never prompts).
- **P11-DC-02 (Medium, open). A denied and an expired sign-in read the
  same.** DFLOW-02 pins the bare `authentication required` row for both
  outcomes, as GAUTH-05 decides. The product's own texts ("User cancelled
  authorization. ...", "Device code expired before authorization. ...") reach
  only the debug log, so the user cannot tell a denial from an expiry. The
  phase pins this rather than changing it, because GAUTH-05 is a recorded
  decision.
- **P11-DC-03 (Low, open). The credential store file as the observation.**
  The scenarios show that a sign-in stored its token, and that a failed one
  stored none, by reading `.git-credentials` in the sandbox HOME, which git's
  `store` helper writes. It is a file the user reads, but it is git's storage,
  not a file this extension writes.
- **P11-DC-04 (Low, open). Out of scope.** Device Flow in print mode, a
  sign-in stand-in that fails its code request, GitLab's Device Flow, and
  Claude Code's `GITHUB_TOKEN`/`GH_TOKEN` reading for background updates
  (D-PL8-12 keeps stored credentials only) get no scenario.
