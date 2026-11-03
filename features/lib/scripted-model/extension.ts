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
  createFauxCore,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";

import { harnessDirectory } from "../turn-records.ts";

import { modelCallsPath, readModelCalls, readModelScript } from "./script.ts";

import type { ModelCall } from "./script.ts";
import type { AssistantMessage, Message, Tool } from "@earendil-works/pi-ai";
import type { FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// The text of a system message's content: a string, or text parts. Pi lays
// out its system messages itself, so content of any other shape fails the
// call loudly rather than log a prompt with a part missing.
function textOf(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    throw new TypeError(
      `scripted model: unreadable system message content ${JSON.stringify(content)}`,
    );
  }

  return content
    .map((part: unknown) => {
      if (
        typeof part !== "object" ||
        part === null ||
        !("text" in part) ||
        typeof part.text !== "string"
      ) {
        throw new TypeError(
          `scripted model: unreadable system message part ${JSON.stringify(part)}`,
        );
      }

      return part.text;
    })
    .join("");
}

// Pi carries the system prompt in system messages: the leading one holds the
// base prompt and its named sections, and a later one adds instructions or
// replaces or removes a section by name. The logged prompt replays them in
// order: every instruction text, then each section that is still present, in
// the order Pi set them, each part separated by a blank line. A section that
// is neither text nor removed fails the call, as above.
function systemPromptOf(messages: readonly Message[]): string {
  const systemMessages = messages.filter((message) => message.role === "system");
  if (systemMessages.length === 0) {
    return "";
  }

  const instructions: string[] = [];
  const sections = new Map<string, string>();
  for (const [index, message] of systemMessages.entries()) {
    const text = textOf(message.content);
    if (index === 0 || text !== "") {
      instructions.push(text);
    }

    const declared: [string, unknown][] = Object.entries(message.sections ?? {});
    for (const [name, section] of declared) {
      if (section === null) {
        sections.delete(name);
      } else if (typeof section === "string") {
        sections.set(name, section);
      } else {
        throw new TypeError(`scripted model: unreadable system prompt section ${name}`);
      }
    }
  }

  return [...instructions, ...sections.values()].join("\n\n");
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
  const faux = createFauxCore({});
  // The faux provider takes one queued response per call. The player queues
  // itself again on every call, so the queue never runs dry and the script
  // alone decides what the model answers.
  const player: FauxResponseFactory = (context) => {
    faux.appendResponses([player]);
    return playNextStep(context.messages);
  };

  faux.setResponses([player]);
  // A new session keeps the selected model only when Pi already counts its
  // provider as configured. A provider registered with a literal key counts
  // at once; one whose key only resolves at request time counts only after an
  // availability pass that runs in the background, so a prompt right after a
  // new session could find no model. The key reaches no service.
  pi.registerProvider(faux.provider, {
    baseUrl: "http://localhost:0",
    apiKey: "scripted-model",
    api: faux.api,
    streamSimple: faux.streamSimple,
    models: faux.models.map((model) => ({
      id: model.id,
      name: model.name,
      input: model.input,
      reasoning: model.reasoning,
      cost: model.cost,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    })),
  });
}
