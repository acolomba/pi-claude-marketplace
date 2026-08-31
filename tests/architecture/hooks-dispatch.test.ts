import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== "build") {
        files.push(...(await collectTypeScriptFiles(entryPath)));
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

test("OBS-01 keeps console.error in the shared debug-log seam only", async () => {
  // arrange
  const extensionRoot = path.join(process.cwd(), "extensions", "pi-claude-marketplace");
  const extensionStat = await stat(extensionRoot);

  // act
  const files = await collectTypeScriptFiles(extensionRoot);
  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/(?:^|[^.\w])console\.error\s*\(/.test(source)) {
      offenders.push(path.relative(extensionRoot, file));
    }
  }

  // assert
  assert.strictEqual(extensionStat.isDirectory(), true);
  assert.deepStrictEqual(offenders.sort(), ["shared/debug-log.ts"]);
});

test("OBS-01 limits extension no-console overrides to the documented files", async () => {
  // arrange
  const configPath = path.join(process.cwd(), "eslint.config.js");
  const expectedPaths = [
    "extensions/pi-claude-marketplace/persistence/migrate.ts",
    "extensions/pi-claude-marketplace/shared/debug-log.ts",
    "extensions/pi-claude-marketplace/shared/notify.ts",
  ];

  // act
  const source = await readFile(configPath, "utf8");
  const allowedPaths: string[] = [];
  for (const match of source.matchAll(/files:\s*\[([^\]]+)]/g)) {
    const arraySource = match[1] ?? "";
    if (!arraySource.includes("extensions/pi-claude-marketplace")) {
      continue;
    }

    const objectTail = source.slice(match.index, match.index + 600);
    if (!/["']no-console["']\s*:\s*["']off["']/.test(objectTail)) {
      continue;
    }

    for (const pathMatch of arraySource.matchAll(/"([^"]+)"/g)) {
      const allowedPath = pathMatch[1];
      if (allowedPath !== undefined) {
        allowedPaths.push(allowedPath);
      }
    }
  }

  // assert
  assert.deepStrictEqual([...new Set(allowedPaths)].sort(), expectedPaths);
});

test("OBS-01 routes hook parser diagnostics through shared debug-log", async () => {
  // arrange
  const hooksPath = path.join(
    process.cwd(),
    "extensions",
    "pi-claude-marketplace",
    "domain",
    "components",
    "hooks.ts",
  );

  // act
  const source = await readFile(hooksPath, "utf8");
  const callSites = source.match(/hookDebugLog\s*\(/g) ?? [];

  // assert
  assert.strictEqual(/^export\s+(?:function|const|let|var)\s+hookDebugLog\b/m.test(source), false);
  assert.strictEqual(/from\s+["']\.\.\/\.\.\/shared\/debug-log\.ts["']/m.test(source), true);
  assert.strictEqual(callSites.length > 0, true);
});
