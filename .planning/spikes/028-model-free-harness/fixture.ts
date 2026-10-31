// Writes a path-source marketplace "fixtures" with one plugin "kit" that ships
// every component kind the extension bridges.
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);

async function put(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

export async function writeMarketplace(root: string): Promise<void> {
  const kit = path.join(root, "plugins", "kit");
  await put(path.join(root, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "fixtures", owner: { name: "spike" }, plugins: [{ name: "kit", source: "./plugins/kit", version: "1.0.0", description: "every component kind" }] }, null, 2));
  await put(path.join(kit, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "kit", version: "1.0.0", description: "every component kind" }));
  await put(path.join(kit, "skills", "hello", "SKILL.md"), "---\nname: hello\ndescription: Say hello from kit.\n---\n\nSay hello.\n");
  await put(path.join(kit, "skills", "hidden", "SKILL.md"), "---\nname: hidden\ndescription: A model-only skill.\nuser-invocable: false\n---\n\nHidden.\n");
  await put(path.join(kit, "commands", "greet.md"), "---\ndescription: Greet someone by name.\nargument-hint: <name>\n---\n\nGreet $ARGUMENTS warmly.\n");
  await put(path.join(kit, "commands", "plain.md"), "Plain command with no frontmatter, first line is the description.\n");
  await put(path.join(kit, "agents", "reviewer.md"), "---\nname: reviewer\ndescription: Reviews code for bugs.\ntools: Read, Grep\nmodel: sonnet\n---\n\nYou review code.\n");
  await put(path.join(kit, "hooks", "hooks.json"), JSON.stringify({ hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/mark.mjs SessionStart" }] }],
    UserPromptSubmit: [{ hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/mark.mjs UserPromptSubmit" }] }],
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/mark.mjs PreToolUse" }] }],
    SessionEnd: [{ hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/mark.mjs SessionEnd" }] }],
  } }, null, 2));
  await put(path.join(kit, "hooks", "mark.mjs"), `import { appendFileSync, readFileSync } from "node:fs";
let stdin = ""; try { stdin = readFileSync(0, "utf8"); } catch {}
appendFileSync(process.env.HOME + "/hook-marks.log", JSON.stringify({ event: process.argv[2], stdin: stdin ? JSON.parse(stdin) : null, pluginRoot: process.env.CLAUDE_PLUGIN_ROOT ?? null, projectDir: process.env.CLAUDE_PROJECT_DIR ?? null }) + "\\n");
`);
  await mkdir(path.join(kit, "mcp"), { recursive: true });
  await copyFile(path.join(HERE, "stub-mcp.mjs"), path.join(kit, "mcp", "stub-mcp.mjs"));
  await put(path.join(kit, ".mcp.json"), JSON.stringify({ mcpServers: { stub: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/mcp/stub-mcp.mjs", "--flag"], env: { STUB_TOKEN: "${STUB_TOKEN:-default-token}" } } } }, null, 2));
  await put(path.join(kit, "workflows", "demo.js"), 'export const meta = { name: "demo", description: "A demo workflow." };\n\nreturn { report: "demo ran with args=" + JSON.stringify(args) };\n');
}
