# Examples

Part of the `changelog` skill: `.agents/skills/changelog/SKILL.md`.

Too long, at 88 words:

> A hook handler's `timeout` is now read as seconds, which is what Claude Code's hooks specification declares and what plugin authors write. The bridge consumed the bare number as milliseconds, so a plugin's `timeout: 2` -- two seconds upstream -- armed a 2 ms SIGTERM that killed the handler at spawn. Every declared timeout was a thousand times shorter than written, and a hook killed that way degraded to a silent no-op with nothing in the output to say so. Thanks to @rakesh-vs for the contribution (#138).

Better, at 33 words, with the PR's other changes nested under it:

> - Hook `timeout` now reads as seconds, the same as Claude Code. It read as milliseconds before, so every declared timeout fired a thousand times early and killed the handler at spawn. Thanks to @rakesh-vs. (#138)
>   - Sync hook defaults now match Claude Code per event: 30 s on `UserPromptSubmit`, 1.5 s on `SessionEnd`, 600 s elsewhere.
>   - A `timeout` that is not a number falls back to its event default instead of failing the install.
