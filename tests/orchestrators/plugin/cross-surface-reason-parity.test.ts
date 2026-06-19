import assert from "node:assert/strict";
import test from "node:test";

import { __test_narrowResolverReasons } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { narrowResolverNotes } from "../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

// Cross-surface parity (HOOK-03 / LIFE-01 / SURF-01): the install cascade
// classifier `narrowResolverReasons` and the read-only probe classifier
// `narrowResolverNotes` MUST emit the SAME closed-set REASONS token for the
// SAME resolver-emitted note. Without this contract, the same on-disk
// condition surfaces with different `(unavailable) {<reason>}` tokens
// depending on which command the user runs (info/list vs install) --
// violating the same-plugin-same-reason invariant.
//
// The four `hooks.json`-prefix families and the `contains lspServers`
// carve-out plus the generic catch-all are the cross-surface pin set.
// Future prefix-set drift on either classifier red-fails this suite.
const PARITY_CASES = [
  {
    note: "hooks.json is not valid JSON: Unexpected token ] in JSON at position 5",
    expected: "unsupported hooks",
  },
  {
    note: "hooks.json failed schema validation: /description: expected array",
    expected: "unsupported hooks",
  },
  {
    note: "unsupported hooks: (a) regex matcher in PreToolUse: /foo.*/",
    expected: "unsupported hooks",
  },
  {
    note: "malformed hooks.json: hooks.json failed schema validation: /description: expected array",
    expected: "unsupported hooks",
  },
  { note: "contains lspServers", expected: "lsp" },
  { note: "some other unsupported source detail", expected: "unsupported source" },
] as const;

for (const { note, expected } of PARITY_CASES) {
  test(`HOOK-03 / SURF-01 cross-surface parity: "${note.slice(0, 40)}..." -> "${expected}" on both surfaces`, () => {
    const probeOut = narrowResolverNotes([note]);
    const installOut = __test_narrowResolverReasons([note]);
    assert.deepEqual(probeOut, [expected], `probe surface emitted ${JSON.stringify(probeOut)}`);
    assert.deepEqual(
      installOut,
      [expected],
      `install surface emitted ${JSON.stringify(installOut)}`,
    );
  });
}
