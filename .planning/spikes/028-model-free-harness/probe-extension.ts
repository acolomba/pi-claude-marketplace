// Probe extension loaded beside the real one. It reads Pi's own registries
// through the public ExtensionAPI and hands them back as a custom entry, so a
// test can observe tools without a model. It also records every event-bus
// message on the channels a companion is known to publish on.
export default function probe(pi: any): void {
  const seen: Array<{ channel: string; data: unknown }> = [];
  for (const channel of (process.env.SPIKE_PROBE_CHANNELS ?? "").split(",").filter(Boolean)) {
    pi.events.on(channel, (data: unknown) => seen.push({ channel, data }));
  }
  pi.registerCommand("spike-probe", {
    description: "spike: dump tools, commands, and bus events",
    handler: async () => {
      pi.appendEntry("spike-probe", {
        allTools: pi.getAllTools().map((t: any) => ({ name: t.name, description: t.description, source: t.sourceInfo?.source ?? t.source })),
        activeTools: pi.getActiveTools(),
        commands: pi.getCommands().map((c: any) => ({ name: c.name, source: c.source })),
        events: seen,
      });
    },
  });
}

// Control: does a command registered during session_start reach get_commands?
export function lateRegistrationControl(pi: any): void {
  pi.on("session_start", () => {
    try {
      pi.registerCommand("spike-late", { description: "registered in session_start", handler: async () => {} });
    } catch (e) {
      pi.appendEntry("spike-late-error", String(e));
    }
  });
}
