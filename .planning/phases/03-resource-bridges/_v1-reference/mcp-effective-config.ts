import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/** Walk the four pi-mcp-adapter file slots; map server name -> first-declaring
 *  path (read order: shared-global, pi-global, shared-project, pi-project).
 *  Missing files / malformed JSON contribute nothing. EACCES propagates. */
export async function loadEffectiveServerNames(cwd: string): Promise<Map<string, string>> {
  const home = homedir();
  const candidates: string[] = [
    path.join(home, ".config", "mcp", "mcp.json"),
    path.join(home, ".pi", "agent", "mcp.json"),
    path.join(cwd, ".mcp.json"),
    path.join(cwd, ".pi", "mcp.json"),
  ];

  const names = new Map<string, string>();
  for (const candidatePath of candidates) {
    let raw: string;
    try {
      raw = await readFile(candidatePath, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        continue;
      }

      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      continue;
    }

    const servers = (parsed as Record<string, unknown>).mcpServers;
    if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
      continue;
    }

    for (const name of Object.keys(servers)) {
      if (!names.has(name)) {
        names.set(name, candidatePath);
      }
    }
  }

  return names;
}
