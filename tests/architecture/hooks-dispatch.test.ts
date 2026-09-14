import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EXTENSION_ROOT_REL, HOOKS_SCHEMA_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

/**
 * The hooks component module, named through the registry group that carries it.
 *
 * D-07-05: the annotation is the membership check -- naming a path the group
 * does not carry stops compiling, so this reference cannot drift away from the
 * set it points into, and the whole path stays one literal the registry scan
 * can see.
 */
const HOOKS_COMPONENT_REL: (typeof HOOKS_SCHEMA_TARGETS)[number] =
  "extensions/pi-claude-marketplace/domain/components/hooks.ts";

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
  const extensionRoot = path.join(REPO_ROOT, EXTENSION_ROOT_REL);
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

test("OBS-01 routes hook parser diagnostics through shared debug-log", async () => {
  // arrange
  const hooksPath = path.join(REPO_ROOT, HOOKS_COMPONENT_REL);

  // act
  const source = await readFile(hooksPath, "utf8");
  const callSites = source.match(/hookDebugLog\s*\(/g) ?? [];

  // assert
  assert.strictEqual(/^export\s+(?:function|const|let|var)\s+hookDebugLog\b/m.test(source), false);
  assert.strictEqual(/from\s+["']\.\.\/\.\.\/shared\/debug-log\.ts["']/m.test(source), true);
  assert.strictEqual(callSites.length > 0, true);
});
