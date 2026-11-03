// Scripted model for the spike. Registers Pi's own faux provider and plays a
// JSON script from $SPIKE_FAUX_SCRIPT, one assistant message per model call.
// Each step is {"text": "..."} or {"tool": "<name>", "args": {...}}. Every call
// logs what the model was shown (last user message text, tool names, system
// prompt excerpt, and tool results) to $HOME/faux-calls.log.
import { appendFileSync, readFileSync } from "node:fs";

import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c: any) => c.text ?? (c.type === "toolCall" ? `[toolCall ${c.name}]` : "")).join("");
  return "";
}

export default function faux(pi: any): void {
  const steps: any[] = process.env.SPIKE_FAUX_SCRIPT ? JSON.parse(readFileSync(process.env.SPIKE_FAUX_SCRIPT, "utf8")) : [];
  const handle = fauxProvider();
  let i = 0;
  const factory = (context: any) => {
    const msgs: any[] = context.messages ?? [];
    appendFileSync(`${process.env.HOME}/faux-calls.log`, JSON.stringify({
      call: i,
      roles: msgs.map((m) => m.role),
      lastUser: textOf([...msgs].reverse().find((m) => m.role === "user")?.content).slice(0, 2000),
      toolResults: msgs.filter((m) => m.role === "toolResult").map((m) => ({ tool: m.toolName, text: textOf(m.content).slice(0, 800), isError: m.isError })),
      tools: (context.tools ?? []).map((t: any) => t.name),
      system: textOf(msgs.find((m) => m.role === "system")?.content ?? context.systemPrompt ?? "").slice(0, 6000),
      keys: Object.keys(context),
    }) + "\n");
    const step = steps[i++] ?? { text: "done" };
    return step.tool ? fauxAssistantMessage([fauxToolCall(step.tool, step.args ?? {})], { stopReason: "toolUse" }) : fauxAssistantMessage([fauxText(step.text)]);
  };
  handle.setResponses(Array.from({ length: 50 }, () => factory));
  pi.registerProvider(handle.provider);
}
