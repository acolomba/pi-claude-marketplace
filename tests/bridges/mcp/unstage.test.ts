import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { unstageMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  McpConfigFileError,
  McpUnstagePartialError,
} from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

async function createScope(
  t: TestContext,
  prefix: string,
): Promise<{ cwd: string; locations: ReturnType<typeof locationsFor> }> {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));

  return { cwd, locations: locationsFor("project", cwd) };
}

/**
 * Points `filePath` at a readable file inside a directory the test makes
 * read-only, so the file reads normally and an atomic write to it fails.
 * Returns the directory, which the case unlocks after acting.
 */
async function lockedLink(
  t: TestContext,
  cwd: string,
  filePath: string,
  bytes: string,
): Promise<string> {
  // A 0o555 directory stays writable for uid 0, so the write this helper
  // exists to refuse would succeed. Refuse up front and name the environment.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("lockedLink cannot deny root; run this suite as a non-root user");
  }

  const lockedDirectory = path.join(cwd, "locked");
  const target = path.join(lockedDirectory, path.basename(filePath));
  await mkdir(lockedDirectory, { recursive: true });
  await writeFile(target, bytes, "utf8");
  await mkdir(path.dirname(filePath), { recursive: true });
  await symlink(target, filePath);
  t.after(async () => {
    await chmod(lockedDirectory, 0o700).catch(() => undefined);
  });
  await chmod(lockedDirectory, 0o555);
  return lockedDirectory;
}

function errnoFields(error: unknown): Record<string, unknown> {
  const filesystemError = error as NodeJS.ErrnoException;
  return { code: filesystemError.code, syscall: filesystemError.syscall };
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
    notices: [],
    written: [{ path: locations.mcpAdapterJsonPath, bytes: Buffer.from(expectedBytes) }],
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
  assert.deepStrictEqual(unstage, { removedNames: [], warnings: [], notices: [], written: [] });
  assert.strictEqual(Object.isFrozen(unstage.removedNames), true);
  assert.strictEqual(Object.isFrozen(unstage.warnings), true);
  assert.strictEqual(Object.isFrozen(unstage.notices), true);
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
  assert.deepStrictEqual(unstage, { removedNames: [], warnings: [], notices: [], written: [] });
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
    assert.deepStrictEqual(unstage, { removedNames: [], warnings: [], notices: [], written: [] });
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
    assert.deepStrictEqual(unstage, { removedNames: [], warnings: [], notices: [], written: [] });
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
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned", "old"],
    warnings: [],
    notices: [],
    written: [{ path: locations.mcpAdapterJsonPath, bytes: Buffer.from(expectedBytes) }],
  });
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
    notices: [],
    written: [{ path: locations.mcpAdapterJsonPath, bytes: Buffer.from(expectedBytes) }],
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
  assert.deepStrictEqual(firstUnstage, {
    removedNames: ["owned"],
    warnings: [],
    notices: [],
    written: [{ path: locations.mcpAdapterJsonPath, bytes: Buffer.from(expectedBytes) }],
  });
  assert.deepStrictEqual(secondUnstage, {
    removedNames: [],
    warnings: [],
    notices: [],
    written: [],
  });
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

test("AFILE-01: removes the plugin's legacy mcp.json entries and keeps foreign entries", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-legacy-");
  const storedBytes =
    '{"mcpServers":{"owned":{"command":"old","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"user":{"command":"user"}},"mcp-servers":{"unread":{"command":"unread","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n';
  const expectedBytes = `{
  "mcpServers": {
    "user": {
      "command": "user"
    }
  },
  "mcp-servers": {
    "unread": {
      "command": "unread",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "official"
      }
    }
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
  const legacyBytes = await readFile(locations.mcpJsonPath, "utf8");
  const adapterMetadata = await stat(locations.mcpAdapterJsonPath).catch((error: unknown) => error);

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned"],
    warnings: [],
    notices: [],
    written: [{ path: locations.mcpJsonPath, bytes: Buffer.from(expectedBytes) }],
  });
  assert.strictEqual(legacyBytes, expectedBytes);
  assert.ok(adapterMetadata instanceof Error);
  assert.strictEqual((adapterMetadata as NodeJS.ErrnoException).code, "ENOENT");
});

test("AFILE-01: lists adapter names first, then legacy names not already listed", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-legacy-order-");
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpAdapterJsonPath,
    '{"mcpServers":{"first":{"command":"first","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"shared":{"command":"shared","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );
  await writeFile(
    locations.mcpJsonPath,
    '{"mcpServers":{"shared":{"command":"shared","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"legacy":{"command":"legacy","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const adapterBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
  const legacyBytes = await readFile(locations.mcpJsonPath, "utf8");

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["first", "shared", "legacy"],
    warnings: [],
    notices: [],
    written: [
      { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
      { path: locations.mcpJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
    ],
  });
  assert.strictEqual(adapterBytes, '{\n  "mcpServers": {}\n}\n');
  assert.strictEqual(legacyBytes, '{\n  "mcpServers": {}\n}\n');
});

test("AFILE-01: leaves a legacy mcp.json with no owned entry unwritten", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-legacy-foreign-");
  const legacyStoredBytes = '{"mcpServers":{"user":{"command":"user"}}}\n';
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpAdapterJsonPath,
    '{"mcpServers":{"owned":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );
  await writeFile(locations.mcpJsonPath, legacyStoredBytes, "utf8");
  const legacyStoredMetadata = await stat(locations.mcpJsonPath, { bigint: true });

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const legacyBytes = await readFile(locations.mcpJsonPath, "utf8");
  const legacyMetadata = await stat(locations.mcpJsonPath, { bigint: true });

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned"],
    warnings: [],
    notices: [],
    written: [
      { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
    ],
  });
  assert.strictEqual(legacyBytes, legacyStoredBytes);
  assert.deepStrictEqual(
    { ino: legacyMetadata.ino, mtimeNs: legacyMetadata.mtimeNs },
    { ino: legacyStoredMetadata.ino, mtimeNs: legacyStoredMetadata.mtimeNs },
  );
});

test("AFILE-01: an unparseable legacy mcp.json refuses before the adapter file is written", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-legacy-invalid-");
  const adapterStoredBytes =
    '{"mcpServers":{"owned":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n';
  const legacyStoredBytes = '{"mcpServers":{"owned":}\n';
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, adapterStoredBytes, "utf8");
  await writeFile(locations.mcpJsonPath, legacyStoredBytes, "utf8");

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
        { filePath: locations.mcpJsonPath, defect: "invalid-jsonc", cause: undefined },
      );
      return true;
    },
  );
  assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), adapterStoredBytes);
  assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), legacyStoredBytes);
});

test("AFILE-01: creates no legacy mcp.json when none exists", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-legacy-absent-");
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpAdapterJsonPath,
    '{"mcpServers":{"owned":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });
  const legacyMetadata = await stat(locations.mcpJsonPath).catch((error: unknown) => error);

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned"],
    warnings: [],
    notices: [],
    written: [
      { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
    ],
  });
  assert.strictEqual(
    await readFile(locations.mcpAdapterJsonPath, "utf8"),
    '{\n  "mcpServers": {}\n}\n',
  );
  assert.ok(legacyMetadata instanceof Error);
  assert.strictEqual((legacyMetadata as NodeJS.ErrnoException).code, "ENOENT");
});

test("AFILE-04: reports dropped comments for a commented mcp-adapter.json it rewrites", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-adapter-comments-");
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpAdapterJsonPath,
    '{\n  // user note\n  "mcpServers": {"owned":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}\n}\n',
    "utf8",
  );

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned"],
    warnings: [],
    notices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
    written: [
      { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
    ],
  });
  assert.strictEqual(Object.isFrozen(unstage.notices), true);
  assert.strictEqual(Object.isFrozen(unstage.written), true);
  assert.strictEqual(
    await readFile(locations.mcpAdapterJsonPath, "utf8"),
    '{\n  "mcpServers": {}\n}\n',
  );
});

test("AFILE-04: reports dropped comments for a commented legacy mcp.json it rewrites", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-legacy-comments-");
  await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
  await writeFile(
    locations.mcpJsonPath,
    '/* legacy */ {"mcpServers":{"owned":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["owned"],
    warnings: [],
    notices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
    written: [{ path: locations.mcpJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') }],
  });
});

test("AFILE-04: reports the adapter file before the legacy file when both held comments", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-both-comments-");
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpJsonPath,
    '// legacy\n{"mcpServers":{"legacy":{"command":"legacy","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );
  await writeFile(
    locations.mcpAdapterJsonPath,
    '// adapter\n{"mcpServers":{"first":{"command":"first","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });

  // assert
  assert.deepStrictEqual(unstage, {
    removedNames: ["first", "legacy"],
    warnings: [],
    notices: [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
      { kind: "comments-dropped", scope: "project", file: "mcp.json" },
    ],
    written: [
      { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
      { path: locations.mcpJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
    ],
  });
});

test("AFILE-04: reports nothing for a commented file with no owned entry", async (t) => {
  // arrange
  const { locations } = await createScope(t, "mcp-unstage-comments-foreign-");
  const storedBytes = '// user note\n{"mcpServers":{"user":{"command":"user"}}}\n';
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");

  // act
  const unstage = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  });

  // assert
  assert.deepStrictEqual(unstage, { removedNames: [], warnings: [], notices: [], written: [] });
  assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), storedBytes);
});

test("AFILE-04: a failed legacy write after the adapter rewrite reports the adapter file's names and notice", async (t) => {
  // arrange
  const { cwd, locations } = await createScope(t, "mcp-unstage-legacy-write-failure-");
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpAdapterJsonPath,
    '// adapter\n{"mcpServers":{"first":{"command":"first","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );
  const lockedDirectory = await lockedLink(
    t,
    cwd,
    locations.mcpJsonPath,
    '{"mcpServers":{"legacy":{"command":"legacy","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
  );

  // act
  const failure = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  }).then(
    () => undefined,
    (error: unknown) => error,
  );
  await chmod(lockedDirectory, 0o700);
  const adapterBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

  // assert
  assert.ok(failure instanceof McpUnstagePartialError);
  assert.deepStrictEqual(
    {
      removedNames: failure.removedNames,
      notices: failure.notices,
      written: failure.written,
      cause: errnoFields(failure.cause),
    },
    {
      removedNames: ["first"],
      notices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
      written: [
        { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
      ],
      cause: { code: "EACCES", syscall: "open" },
    },
  );
  assert.strictEqual(adapterBytes, '{\n  "mcpServers": {}\n}\n');
});

test("TR-03: a failed legacy write does not report a name the legacy file still holds as removed", async (t) => {
  // arrange
  const { cwd, locations } = await createScope(t, "mcp-unstage-legacy-write-shared-name-");
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(
    locations.mcpAdapterJsonPath,
    '{"mcpServers":{"srv":{"command":"srv","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}},"first":{"command":"first","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
    "utf8",
  );
  const legacyBytes =
    '{"mcpServers":{"srv":{"command":"srv","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n';
  const lockedDirectory = await lockedLink(t, cwd, locations.mcpJsonPath, legacyBytes);

  // act
  const failure = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  }).then(
    () => undefined,
    (error: unknown) => error,
  );
  await chmod(lockedDirectory, 0o700);

  // assert
  assert.ok(failure instanceof McpUnstagePartialError);
  assert.deepStrictEqual(
    {
      removedNames: failure.removedNames,
      notices: failure.notices,
      written: failure.written,
      cause: errnoFields(failure.cause),
      legacy: await readFile(locations.mcpJsonPath, "utf8"),
    },
    {
      removedNames: ["first"],
      notices: [],
      written: [
        { path: locations.mcpAdapterJsonPath, bytes: Buffer.from('{\n  "mcpServers": {}\n}\n') },
      ],
      cause: { code: "EACCES", syscall: "open" },
      legacy: legacyBytes,
    },
  );
});

test("rethrows a failed adapter write unchanged when no file was rewritten", async (t) => {
  // arrange
  const { cwd, locations } = await createScope(t, "mcp-unstage-adapter-write-failure-");
  const lockedDirectory = await lockedLink(
    t,
    cwd,
    locations.mcpAdapterJsonPath,
    '{"mcpServers":{"first":{"command":"first","_piClaudeMarketplace":{"plugin":"acme","marketplace":"official"}}}}\n',
  );

  // act
  const failure = await unstageMcpServers({
    locations,
    marketplaceName: "official",
    pluginName: "acme",
  }).then(
    () => undefined,
    (error: unknown) => error,
  );
  await chmod(lockedDirectory, 0o700);

  // assert
  assert.ok(failure instanceof Error);
  assert.deepStrictEqual(
    { partial: failure instanceof McpUnstagePartialError, ...errnoFields(failure) },
    { partial: false, code: "EACCES", syscall: "open" },
  );
});
