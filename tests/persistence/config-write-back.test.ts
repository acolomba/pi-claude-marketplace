import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { writeMarketplaceConfigEntry } from "../../extensions/pi-claude-marketplace/persistence/config-write-back.ts";

test("patches one marketplace and writes one complete validated document", async (t) => {
  // arrange
  const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-marketplace-"));
  t.after(() => rm(scopeRoot, { recursive: true, force: true }));
  const filePath = path.join(scopeRoot, "claude-plugins.json");
  const current = {
    schemaVersion: 1,
    marketplaces: {
      tools: { source: "acme/tools", autoupdate: false },
      adjacent: { source: "acme/adjacent", autoupdate: true },
    },
    plugins: {
      "reviewer@tools": { enabled: false },
    },
  } satisfies ScopeConfig;
  const patch = { autoupdate: true } as const;
  const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "autoupdate": true
    },
    "adjacent": {
      "source": "acme/adjacent",
      "autoupdate": true
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": false
    }
  }
}
`;

  // act
  await writeMarketplaceConfigEntry(current, filePath, scopeRoot, "tools", patch);
  const configBytes = await readFile(filePath, "utf8");

  // assert
  assert.strictEqual(configBytes, expectedBytes);
});
