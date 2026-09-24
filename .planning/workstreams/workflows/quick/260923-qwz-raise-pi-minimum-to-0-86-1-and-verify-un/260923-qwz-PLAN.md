---
phase: 260923-qwz
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [NFR-11]
---

<objective>
Raise the marketplace's Pi peer floor to 0.86.1 and check whether the
published, unpatched workflow engine works with that host in a normal Pi load.
</objective>

<tasks>

<task>
<name>Align the declared floor, development dependency, lockfile, gates, and current documentation</name>
<action>
Update package.json and package-lock.json. Change the direct peer-floor test and
the current compatibility text to 0.86.1. Update current project instructions
and codebase stack notes that still claim the old floor. Keep historical
changelog and research records as historical evidence. Do not touch the user's
unrelated working-tree files.
</action>
<verify>Run the peer-floor and workflow documentation tests, lockfile validation,
and the repository check gate.</verify>
</task>

<task>
<name>Smoke-test the published engine without the three patches</name>
<action>
Use a disposable Pi home and the published 3.13.0 engine, hosted by Pi 0.86.1.
Load through Pi's normal extension discovery path. Exercise a small OpenAI saved
workflow through the marketplace bridge. Check native child tool calls, parent
delivery, pending-delivery acknowledgement, and persisted run status. Record
exact installed versions and any blocker in the quick summary.
</action>
<verify>Inspect the run and parent session artifacts; do not infer a pass from
the patched combined-engine smoke test.</verify>
</task>

</tasks>
