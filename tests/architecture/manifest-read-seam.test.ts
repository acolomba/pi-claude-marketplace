import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace");
const ALLOWED_RELATIVE_PATH = "domain/manifest.ts";

async function collectTypeScriptFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectTypeScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(fullPath);
    }
  }

  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function hasMarketplaceManifestRead(src: string): boolean {
  const readCallContext = /(?:\breadFile\b|\bfs\.readFile\b)\s*\([\s\S]{0,400}?marketplace\.json/g;
  return readCallContext.test(src);
}

test("NFR-8 manifest read seam: only domain/manifest.ts reads marketplace.json", async () => {
  const offenders: string[] = [];
  const files = await collectTypeScriptFiles(EXTENSION_ROOT);

  for (const filePath of files) {
    const rel = path.relative(EXTENSION_ROOT, filePath).split(path.sep).join("/");
    if (rel === ALLOWED_RELATIVE_PATH) {
      continue;
    }

    const stripped = stripComments(await readFile(filePath, "utf8"));
    if (hasMarketplaceManifestRead(stripped)) {
      offenders.push(`extensions/pi-claude-marketplace/${rel}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `NFR-8 manifest read seam violation: marketplace.json readFile call(s) outside domain/manifest.ts:\n  ${offenders.join("\n  ")}`,
  );
});
