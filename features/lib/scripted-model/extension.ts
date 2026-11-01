/**
 * @fileoverview The scripted model: a Pi extension that registers Pi's faux
 * provider and answers each model call with the next step of the scenario's
 * script (D-CF1-17, HAR-02).
 *
 * A profile Pi loads this file with `--extension`. Each call reads the script
 * from the harness directory of `$HOME`, takes the step whose index is the
 * line count of the call log, and appends the call to the log whole: the
 * system prompt, the tools, and every message. The model keeps no count in
 * memory, so a child agent's Pi, which shares the sandbox home, plays the
 * same script. A call past the end of the script is logged with
 * `overflow: true` and fails: there is no fallback reply. Two processes that
 * call at the same moment would read the same count and take the same step,
 * so a scenario must not make concurrent model calls.
 */

import { appendFile } from "node:fs/promises";

import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";

import { harnessDirectory } from "../turn-records.ts";

import { modelCallsPath, readModelCalls, readModelScript } from "./script.ts";

import type { ModelCall } from "./script.ts";
import type { AssistantMessage, Message, Tool } from "@earendil-works/pi-ai";
import type { FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function textOf(content: string | readonly { readonly type: string; text?: string }[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => part.text ?? "").join("");
}

// Pi carries the system prompt and the tool declarations in system messages:
// the leading one holds the base prompt and its sections, and later ones add
// and remove tools.
function systemPromptOf(messages: readonly Message[]): string {
  const leading = messages.find((message) => message.role === "system");
  if (leading === undefined) {
    return "";
  }

  const sections = Object.values(leading.sections ?? {}).filter(
    (section): section is string => section !== null,
  );
  return [textOf(leading.content), ...sections].join("\n\n");
}

function toolsOf(messages: readonly Message[]): ModelCall["tools"] {
  const tools = new Map<string, Tool>();
  for (const message of messages) {
    if (message.role !== "system") {
      continue;
    }

    for (const tool of message.toolsAdded ?? []) {
      tools.set(tool.name, tool);
    }

    for (const removed of message.toolsRemoved ?? []) {
      tools.delete(removed.name);
    }
  }

  return [...tools.values()].map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

async function playNextStep(messages: readonly Message[]): Promise<AssistantMessage> {
  const harness = harnessDirectory(process.env.HOME ?? "");
  const [script, calls] = await Promise.all([readModelScript(harness), readModelCalls(harness)]);
  const index = calls.length;
  const step = script[index];
  const call: ModelCall = {
    index,
    overflow: step === undefined,
    systemPrompt: systemPromptOf(messages),
    tools: toolsOf(messages),
    messages: [...messages],
  };
  await appendFile(modelCallsPath(harness), `${JSON.stringify(call)}\n`);
  if (step === undefined) {
    throw new Error(
      `scripted model: call ${index + 1} has no step; the script has ${script.length}`,
    );
  }

  if ("reply" in step) {
    return fauxAssistantMessage([fauxText(step.reply)]);
  }

  // The script validator admits only JSON values, so the arguments are a JSON object.
  const toolArguments = step.arguments as Parameters<typeof fauxToolCall>[1];
  return fauxAssistantMessage([fauxToolCall(step.tool, toolArguments)], {
    stopReason: "toolUse",
  });
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function scriptedModel(pi: ExtensionAPI): void {
  const handle = fauxProvider();
  // The faux provider takes one queued response per call. The player queues
  // itself again on every call, so the queue never runs dry and the script
  // alone decides what the model answers.
  const player: FauxResponseFactory = (context) => {
    handle.appendResponses([player]);
    return playNextStep(context.messages);
  };

  handle.setResponses([player]);
  pi.registerProvider(handle.provider);
}
