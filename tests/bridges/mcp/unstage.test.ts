import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { unstageMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { McpConfigFileError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

async function createScope(
  t: TestContext,
  prefix: string,
): Promise<{ cwd: string; locations: ReturnType<typeof locationsFor> }> {
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
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const rewrittenBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
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

test("returns an empty frozen result without materializing a missing document", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-missing-");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const storedMetadata = await stat(locations.mcpAdapterJsonPath).catch((error: unknown) => error);

  // assert
  assert.deepStrictEqual(unstage, { removedNames: [], warnings: [] });
  assert.strictEqual(Object.isFrozen(unstage.removedNames), true);
  assert.strictEqual(Object.isFrozen(unstage.warnings), true);
  assert.ok(storedMetadata instanceof Error);
  assert.strictEqual((storedMetadata as NodeJS.ErrnoException).code, "ENOENT");
});

test("treats an unavailable parent path as a missing document", async (t) => {
  // arrange
  const { cwd, locations } = await createScope(t, "mcp-unstage-not-directory-");
  const scopeRootBytes = "occupied by a file\n";
  await writeFile(path.join(cwd, ".pi"), scopeRootBytes, "utf8");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const retainedBytes = await readFile(path.join(cwd, ".pi"), "utf8");

  // assert
  assert.deepStrictEqual(unstage, { removedNames: [], warnings: [] });
  assert.strictEqual(retainedBytes, scopeRootBytes);
});

test("rethrows an ordinary document read failure unchanged", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-read-failure-");
  await mkdir(locations.mcpAdapterJsonPath, { recursive: true });

  // act & assert
  await assert.rejects(
    () =>
      unstageMcpServers({
        locations,
        marketplaceName: "official",
        pluginName: "acme",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const filesystemError = error as NodeJS.ErrnoException;
      assert.deepStrictEqual(
        {
          constructor: filesystemError.constructor,
          // The errno message is not projected: later runtime majors append the offending path to
          // it. The code, errno and syscall it derives from are the contract.
          name: filesystemError.name,
          code: filesystemError.code,
          errno: filesystemError.errno,
          syscall: filesystemError.syscall,
        },
        {
          constructor: Error,
          name: "Error",
          code: "EISDIR",
          errno: -21,
          syscall: "read",
        },
      );
      return true;
    },
  );
});

test("AFILE-02: rejects invalid JSONC with a typed error and no cause", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-malformed-");
  const storedBytes = "{";
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");

  // act & assert
  await assert.rejects(
    () =>
      unstageMcpServers({
        locations,
        marketplaceName: "official",
        pluginName: "acme",
      }),
    (error: unknown) => {
      assert.ok(error instanceof McpConfigFileError);
      assert.deepStrictEqual(
        { filePath: error.filePath, defect: error.defect, cause: error.cause },
        { filePath: locations.mcpAdapterJsonPath, defect: "invalid-jsonc", cause: undefined },
      );
      return true;
    },
  );
  assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), storedBytes);
});

for (const { description, storedBytes } of [
  { description: "null", storedBytes: "null\n" },
  { description: "a number", storedBytes: "17\n" },
  { description: "a string", storedBytes: '"foreign"\n' },
  { description: "a boolean", storedBytes: "true\n" },
  { description: "an array", storedBytes: '[{"foreign":true}]\n' },
]) {
  test(`preserves ${description} top-level document without rewriting it`, async (t) => {
    // arrange
    const { locations } = await createScope(t, "mcp-unstage-primitive-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");
    const storedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

    // act
    const unstage = await unstageMcpServers({
      locations,
      marketplaceName: "official",
      pluginName: "acme",
    });
    const retainedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    const retainedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

    // assert
    assert.deepStrictEqual(unstage, { removedNames: [], warnings: [] });
    assert.strictEqual(retainedBytes, storedBytes);
    assert.deepStrictEqual(
      {
        ino: retainedMetadata.ino,
        size: retainedMetadata.size,
        mtimeNs: retainedMetadata.mtimeNs,
        ctimeNs: retainedMetadata.ctimeNs,
      },
      {
        ino: storedMetadata.ino,
        size: storedMetadata.size,
        mtimeNs: storedMetadata.mtimeNs,
        ctimeNs: storedMetadata.ctimeNs,
      },
    );
  });
}

for (const { description, storedBytes } of [
  {
    description: "a document without mcpServers",
    storedBytes: '{"foreignTopLevel":{"keep":true}}\n',
  },
  {
    description: "a document with no matching owner",
    storedBytes:
      '{"mcpServers":{"foreign":{"command":"keep","_piClaudeMarketplace":{"plugin":"other","marketplace":"official"}},"unmarked":{"command":"keep-too"}},"keep":3}\n',
  },
]) {
  test(`preserves ${description} byte-for-byte without rewriting it`, async (t) => {
    // arrange
    const { locations } = await createScope(t, "mcp-unstage-noop-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");
    const storedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

    // act
    const unstage = await unstageMcpServers({
      locations,
      marketplaceName: "official",
      pluginName: "acme",
    });
    const retainedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    const retainedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

    // assert
    assert.deepStrictEqual(unstage, { removedNames: [], warnings: [] });
    assert.strictEqual(retainedBytes, storedBytes);
    assert.deepStrictEqual(
      {
        ino: retainedMetadata.ino,
        size: retainedMetadata.size,
        mtimeNs: retainedMetadata.mtimeNs,
        ctimeNs: retainedMetadata.ctimeNs,
      },
      {
        ino: storedMetadata.ino,
        size: storedMetadata.size,
        mtimeNs: storedMetadata.mtimeNs,
        ctimeNs: storedMetadata.ctimeNs,
      },
    );
  });
}

for (const { description, storedBytes, defect } of [
  {
    description: "a null mcpServers field",
    storedBytes: '{"mcpServers":null,"keep":true}\n',
    defect: "mcpServers-not-object",
  },
  {
    description: "a string mcpServers field",
    storedBytes: '{"mcpServers":"foreign","keep":true}\n',
    defect: "mcpServers-not-object",
  },
  {
    description: "an array mcpServers field",
    storedBytes: '{"mcpServers":[{"command":"foreign"}],"keep":true}\n',
    defect: "mcpServers-not-object",
  },
  {
    description: "a boolean mcpServers field",
    storedBytes: '{"mcpServers":true,"keep":true}\n',
    defect: "mcpServers-not-object",
  },
  {
    description: "a number mcpServers field",
    storedBytes: '{"mcpServers":17,"keep":true}\n',
    defect: "mcpServers-not-object",
  },
  {
    description: "an array mcp-servers field",
    storedBytes: '{"mcp-servers":[],"keep":true}\n',
    defect: "mcp-servers-not-object",
  },
] as const) {
  test(`AFILE-02: rejects ${description} without changing the scoped document`, async (t) => {
    // arrange
    const { locations } = await createScope(t, "mcp-unstage-malformed-field-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");
    const storedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

    // act & assert
    await assert.rejects(
      () =>
        unstageMcpServers({
          locations,
          marketplaceName: "official",
          pluginName: "acme",
        }),
      (error: unknown) => {
        assert.ok(error instanceof McpConfigFileError);
        assert.deepStrictEqual(
          { filePath: error.filePath, defect: error.defect, cause: error.cause },
          { filePath: locations.mcpAdapterJsonPath, defect, cause: undefined },
        );
        return true;
      },
    );
    const retainedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    const retainedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });
    assert.strictEqual(retainedBytes, storedBytes);
    assert.deepStrictEqual(
      {
        ino: retainedMetadata.ino,
        size: retainedMetadata.size,
        mtimeNs: retainedMetadata.mtimeNs,
        ctimeNs: retainedMetadata.ctimeNs,
      },
      {
        ino: storedMetadata.ino,
        size: storedMetadata.size,
        mtimeNs: storedMetadata.mtimeNs,
        ctimeNs: storedMetadata.ctimeNs,
      },
    );
  });
}

test("AFILE-01: removes owned entries under both server keys and keeps a marker-less stub", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-both-keys-");
  const storedBytes =
    '{"mcp-servers":{"old":{"command":"old-server","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"theirs":{"command":"their-server"}},"mcpServers":{"old":{"disabled":true},"owned":{"command":"owned-server","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n';
  const expectedBytes = `{
  "mcp-servers": {
    "theirs": {
      "command": "their-server"
    }
  },
  "mcpServers": {
    "old": {
      "disabled": true
    }
  }
}
`;
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });

  // assert
  assert.deepStrictEqual(unstage, { removedNames: ["owned", "old"], warnings: [] });
  assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), expectedBytes);
});

test("removes owned prototype-named servers and keeps foreign inherited names", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-prototype-names-");
  const storedBytes =
    '{"mcpServers":{"__proto__":{"command":"owned-proto","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"constructor":{"command":"owned-constructor","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"toString":{"command":"foreign-method","_piClaudeMarketplace":{"plugin":"other","marketplace":"official"}},"hasOwnProperty":{"command":"foreign-own"}},"keep":"top-level"}\n';
  const expectedBytes = `{
  "mcpServers": {
    "toString": {
      "command": "foreign-method",
      "_piClaudeMarketplace": {
        "plugin": "other",
        "marketplace": "official"
      }
    },
    "hasOwnProperty": {
      "command": "foreign-own"
    }
  },
  "keep": "top-level"
}
`;
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const rewrittenBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["__proto__", "constructor"],
    warnings: [],
  });
  assert.strictEqual(rewrittenBytes, expectedBytes);
});

test("leaves the first rewritten document unchanged on a second unstage", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-idempotent-");
  const storedBytes =
    '{"mcpServers":{"owned":{"command":"remove","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"foreign":{"command":"keep","env":{"A":"1"}}},"keep":true}\n';
  const expectedBytes = `{
  "mcpServers": {
    "foreign": {
      "command": "keep",
      "env": {
        "A": "1"
      }
    }
  },
  "keep": true
}
`;
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");

  // act
  const firstUnstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const firstBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
  const firstMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });
  const secondUnstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const secondBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
  const secondMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

  // assert
  assert.deepStrictEqual(firstUnstage, { removedNames: ["owned"], warnings: [] });
  assert.deepStrictEqual(secondUnstage, { removedNames: [], warnings: [] });
  assert.strictEqual(firstBytes, expectedBytes);
  assert.strictEqual(secondBytes, expectedBytes);
  assert.deepStrictEqual(
    {
      ino: secondMetadata.ino,
      size: secondMetadata.size,
      mtimeNs: secondMetadata.mtimeNs,
      ctimeNs: secondMetadata.ctimeNs,
    },
    {
      ino: firstMetadata.ino,
      size: firstMetadata.size,
      mtimeNs: firstMetadata.mtimeNs,
      ctimeNs: firstMetadata.ctimeNs,
    },
  );
});
