# Tools

Part of the `typescript-unit-tests` skill: `.agents/skills/typescript-unit-tests/SKILL.md`.

A test module imports the tools like this:

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mock, verify, when } from "strong-mock";
```

Do not import the process-wide `mock` from `node:test`; use the context's `t.mock` (stubs, spies, fake timers).
