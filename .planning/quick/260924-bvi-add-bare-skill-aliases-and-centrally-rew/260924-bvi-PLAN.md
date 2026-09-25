---
status: in_progress
date: 2026-09-24
description: Add bare and plugin-qualified skill aliases and centrally rewrite installed plugin Markdown references for release 0.19.2
---

# Skill aliases and reference conversion

1. Build a shared inventory of installed skill and command names and one Markdown reference converter. Stage canonical `/skill:<name>` and platform-specific command references across installed Markdown, including agent bodies; remove the agent legend. Verify real staging and Windows behavior.
2. Add bare and `/plugin:skill` interactive aliases and completion for loaded marketplace skills while keeping native `/skill:` names and command/template priority. Verify lifecycle and collisions.
3. Update documentation and 0.19.2 version files; run the full quality gates; commit code and prepare the release PR against `releases/v0.19.2`.
