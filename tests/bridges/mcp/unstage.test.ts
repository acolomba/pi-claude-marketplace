import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { unstageMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

async function createScope(t: TestContext, prefix: string) {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));

  return { cwd, locations: locationsFor("project", cwd) };
}

test("removes every exact owner and preserves the complete foreign document", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-owned-");
  const storedBytes = `{
  "version": 3,
  "mcpServers": {
    "owned-first": {
      "command": "owned-a",
      "args": ["--stdio"],
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "official"
      }
    },
    "same-plugin-other-marketplace": {
      "command": "foreign-marketplace",
      "env": {
        "KEEP": "marketplace"
      },
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "community"
      }
    },
    "same-marketplace-other-plugin": {
      "command": "foreign-plugin",
      "_piClaudeMarketplace": {
        "plugin": "beta",
        "marketplace": "official"
      }
    },
    "unmarked": {
      "command": "foreign-unmarked",
      "args": ["one", "two"],
      "disabled": false
    },
    "__proto__": {
      "command": "foreign-prototype",
      "env": {
        "SAFE": "yes"
      }
    },
    "constructor": {
      "command": "foreign-constructor"
    },
    "owned-last": {
      "command": "owned-b",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "official"
      }
    }
  },
  "foreignTopLevel": {
    "enabled": true,
    "labels": ["keep", "exact"]
  }
}
`;
  const expectedBytes = `{
  "version": 3,
  "mcpServers": {
    "same-plugin-other-marketplace": {
      "command": "foreign-marketplace",
      "env": {
        "KEEP": "marketplace"
      },
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "community"
      }
    },
    "same-marketplace-other-plugin": {
      "command": "foreign-plugin",
      "_piClaudeMarketplace": {
        "plugin": "beta",
        "marketplace": "official"
      }
    },
    "unmarked": {
      "command": "foreign-unmarked",
      "args": [
        "one",
        "two"
      ],
      "disabled": false
    },
    "__proto__": {
      "command": "foreign-prototype",
      "env": {
        "SAFE": "yes"
      }
    },
    "constructor": {
      "command": "foreign-constructor"
    }
  },
  "foreignTopLevel": {
    "enabled": true,
    "labels": [
      "keep",
      "exact"
    ]
  }
}
`;
  await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
  await writeFile(locations.mcpJsonPath, storedBytes, "utf8");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const rewrittenBytes = await readFile(locations.mcpJsonPath, "utf8");
  const rewrittenDocument = JSON.parse(rewrittenBytes) as {
    mcpServers: Record<string, unknown>;
  };

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned-first", "owned-last"],
    warnings: [],
  });
  assert.strictEqual(rewrittenBytes, expectedBytes);
  assert.strictEqual(Object.hasOwn(rewrittenDocument.mcpServers, "__proto__"), true);
  assert.strictEqual(Object.getPrototypeOf(rewrittenDocument.mcpServers), Object.prototype);
  assert.strictEqual(({} as Record<string, unknown>).command, undefined);
});
