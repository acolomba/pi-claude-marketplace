## Deferred Items

- Stop human-checklist wording predates the headless cap drive
  status: open
  **What:** In `tests/live-uat/README.md`, the "Human verification checklist" intro says a headless
  `pi -p` drive "tears down its non-interactive lifecycle after the initial request". Item 4 says
  "the scripted `stop-canary.mjs` proves only the first re-entry; headless `pi` cannot sustain the
  loop". The Pi 1.0.0 run reaches the cap headless (8 blocks, pi exit 0), so only the cap-trip
  warning still needs a human. The plan limited README edits to the region between
  `## Stop contract canary` and `### Real-plugin run`, and these lines sit below it.
- Agent-failure canary install comment names engine 3.10.1 and `/tmp`
  status: open
  **What:** `tests/live-uat/workflow-agent-failure-canary.mjs:21` shows
  `npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.10.1`. The README and
  the storage canary now name 3.13.1 under `/var/tmp`. The plan named only the storage canary's
  comment.
