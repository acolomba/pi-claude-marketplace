# Spike S7: what Pi tells an extension at `session_start` on a launch with a saved session

PG-HOOK-11, D-PG6-13. This record holds the commands, the raw output, and the result. It is evidence, not a test. Plan 06-03 reads `## Result` before it writes any detection code.

## Environment

- Date: 2026-11-14 (UTC 22:24 to 22:28).
- Node: v26.13.1. Platform: Linux.
- Commit at the start of the spike: `a1f54614` on `features/gaps`.
- Pi 1.5.0: the repository copy, `node_modules/@earendil-works/pi-coding-agent/dist/cli.js`; `package.json` reads `"version": "1.5.0"`.
- Pi 1.5.2: the Homebrew copy, `/home/linuxbrew/.linuxbrew/Cellar/pi-coding-agent/1.5.2/libexec/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js` (the `bin.pi` entry of its `package.json`, which reads `"version": "1.5.2"`).
- Home: every launch ran with `HOME=<tmp>/home`, `PI_CODING_AGENT_DIR=<tmp>/agent`, `TMPDIR=<tmp>/tmp`, `PI_OFFLINE=1`, and `--offline`. `<tmp>` is a folder that `mktemp -d` made for the spike, one per Pi version, under the session scratch directory `/tmp/claude-1000/.../scratchpad/`. The runner checked before every launch that `HOME` and `PI_CODING_AGENT_DIR` both start with `<tmp>`, and stopped otherwise. No launch read or wrote the real `~/.pi/agent`. Both temporary folders were removed after the record was written. One file landed outside them: the first, failed attempt of launch 1 ran before the runner set `TMPDIR`, so jiti wrote its compile of the probe to the shared `/tmp/jiti/p0601-tmp150-bzfOsv-probe.00503f20.mjs`; that file was removed, and every later launch compiled into `<tmp>/tmp/jiti`.
- Mode: print mode (`-p`) with one prompt per launch, text output, stdin from `/dev/null`. Print mode sends the prompt and ends the run, and it saves the session, because the spike never passes `--no-session`. Launch 11 uses RPC mode with stdin closed, to read `ctx.model` with no model flag.
- Model: an offline stub, not the repository's scripted model (see the next section). It registers Pi's faux provider (`faux` / `faux-1`) and answers every call with `stub reply`. Its base URL `http://localhost:0` is never contacted. No provider key was set.

### The scripted model does not load from the command line

The plan named `features/lib/scripted-model/extension.ts` as the model. The first attempt of launch 1 on Pi 1.5.0 failed to load it:

```text
Error: Failed to load extension "<repo>/features/lib/scripted-model/extension.ts": Failed to load extension: Cannot find module '<repo>/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/pi-ai-extension-view.js/providers/faux'
Require stack:
- <repo>/features/lib/scripted-model/extension.ts
Error: Unknown provider "faux". Use --list-models to see available providers/models.
Hint: Start without extensions using "pi -ne".
```

Pi 1.5.0's extension loader (`dist/core/extensions/loader.js`, `getAliases`) maps the specifier `@earendil-works/pi-ai` to its own `pi-ai-extension-view.js` and lists no alias for `@earendil-works/pi-ai/providers/faux`, so jiti's prefix match turns the subpath into a path under that file. The same error came back with a clean environment (`env -i`) and a private `TMPDIR`. The spike did not find out how the cucumber harness avoids this, and that question is outside S7. The stub imports `createFauxCore`, `fauxAssistantMessage`, and `fauxText` from the pi-ai root, which re-exports the faux provider, and it loaded in both versions. The stub changes only who answers the prompt; the probe reads nothing the model sets except `ctx.model`.

## Commands

The runner `p0601-run.sh` (scratch directory, not in the repository) ran each launch as below, from `<tmp>/<folder>`, and printed Pi's exit status, Pi's output, and the probe's line. `<cli>` is the entry file of the Pi version. Pi 1.5.2 also got `PI_SKIP_VERSION_CHECK=1`, as its Homebrew wrapper sets.

```sh
# set up, once per version
T=$(mktemp -d -p <scratchpad> p0601-tmp150-XXXXXX)        # p0601-tmp152-XXXXXX for 1.5.2
mkdir -p $T/home $T/agent $T/project $T/empty $T/tmp
cp p0601-probe.ts $T/probe.ts; cp p0601-stub-model.ts $T/stub-model.ts

# every launch (the runner)
export HOME=<tmp>/home PI_CODING_AGENT_DIR=<tmp>/agent PI_OFFLINE=1 TMPDIR=<tmp>/tmp PROBE_LOG=<tmp>/probe-<label>.jsonl
case "$HOME" in "<tmp>"/*) ;; *) exit 99;; esac
case "$PI_CODING_AGENT_DIR" in "<tmp>"/*) ;; *) exit 99;; esac
unset ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY PI_CODING_AGENT_SESSION_DIR
cd <tmp>/<folder>
node <cli> --offline --extension <tmp>/probe.ts --extension <tmp>/stub-model.ts \
  --provider faux --model faux-1 <flags> -p "prompt from <label>" </dev/null

# the launches, in order; F1 = the session file launch 1 wrote, HF = the hand-written file
L1  project  (no flag)
L2  project  --continue
L3  project  --session $F1
L4  project  --fork $F1
L5  project  --continue
L6  project  (no flag)
L7  empty    --continue
L8a project  --name spike-named
L8b project  --continue
    HF=$(node p0601-handwrite.mjs "$(dirname $F1)" <tmp>/project)   # writes the file below
L9  project  --session $HF
L10 project  --continue

# launch 11: RPC mode, no model flag, stdin closed
cd <tmp>/empty && env -i HOME=<tmp>/home PI_CODING_AGENT_DIR=<tmp>/agent PI_OFFLINE=1 PATH=$PATH \
  TMPDIR=<tmp>/tmp PROBE_LOG=<tmp>/probe-L11.jsonl \
  node <cli> --mode rpc --offline --extension <tmp>/probe.ts --extension <tmp>/stub-model.ts </dev/null
```

The probe (`<tmp>/probe.ts`) appends one JSON line on `session_start`:

```ts
import { appendFileSync } from "node:fs";
export default function probe(pi: any): void {
  pi.on("session_start", (event: any, ctx: any) => {
    const sm = ctx.sessionManager;
    const entries = sm.getEntries();
    const line = {
      reason: event.reason,
      previousSessionFile: event.previousSessionFile,
      sessionId: sm.getSessionId(),
      sessionFile: sm.getSessionFile(),
      header: sm.getHeader(),
      entryTypes: entries.map((e: any) => e.type),
      messageCount: entries.filter((e: any) => e.type === "message").length,
      sessionName: sm.getSessionName(),
      modelId: ctx.model?.id,
      thinkingLevel: ctx.thinkingLevel,
      timeOrigin: performance.timeOrigin,
      timeOriginIso: new Date(performance.timeOrigin).toISOString(),
      now: Date.now(),
    };
    appendFileSync(process.env.PROBE_LOG as string, JSON.stringify(line) + "\n");
  });
}
```

`JSON.stringify` drops a key whose value is `undefined`, so a line with no `previousSessionFile` or `sessionName` key means the value was `undefined`.

The hand-written session file (`<tmp>/agent/sessions/--<tmp>-project--/2026-11-01T10-00-00-000Z_0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001.jsonl`), in the form of launch 1's file, with a header and one user and one assistant `message` entry:

```json
{"type":"session","version":3,"id":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","timestamp":"2026-11-01T10:00:00.000Z","cwd":"<tmp>/project"}
{"type":"message","id":"aaaa0001","parentId":null,"timestamp":"2026-11-01T10:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"hand-written prompt"}],"timestamp":1793527201000}}
{"type":"message","id":"aaaa0002","parentId":"aaaa0001","timestamp":"2026-11-01T10:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"hand-written reply"}],"api":"faux","provider":"faux","model":"faux-1","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"stopReason":"stop","timestamp":1793527202000}}
```

## Output: Pi 1.5.0

### Launch 1: no session flag (new session, one prompt)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc29-a27f-70c7-9502-b6feb03d432b","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-38-530Z_01a1dc29-a27f-70c7-9502-b6feb03d432b.jsonl","header":{"type":"session","version":3,"id":"01a1dc29-a27f-70c7-9502-b6feb03d432b","timestamp":"2026-11-14T22:24:38.530Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695076630.355,"timeOriginIso":"2026-11-14T22:24:36.630Z","now":1794695079127}
```

Reason `startup`; no `message` entry held.

### Launch 2: --continue

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc29-a27f-70c7-9502-b6feb03d432b","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-38-530Z_01a1dc29-a27f-70c7-9502-b6feb03d432b.jsonl","header":{"type":"session","version":3,"id":"01a1dc29-a27f-70c7-9502-b6feb03d432b","timestamp":"2026-11-14T22:24:38.530Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change","message","message","message"],"messageCount":3,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695091269.143,"timeOriginIso":"2026-11-14T22:24:51.269Z","now":1794695093312}
```

Reason `startup`; 3 `message` entries held.

### Launch 3: `--session <file of launch 1>`

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc29-a27f-70c7-9502-b6feb03d432b","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-38-530Z_01a1dc29-a27f-70c7-9502-b6feb03d432b.jsonl","header":{"type":"session","version":3,"id":"01a1dc29-a27f-70c7-9502-b6feb03d432b","timestamp":"2026-11-14T22:24:38.530Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change","message","message","message","message","message"],"messageCount":5,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695093408.716,"timeOriginIso":"2026-11-14T22:24:53.408Z","now":1794695095423}
```

Reason `startup`; 5 `message` entries held.

### Launch 4: `--fork <file of launch 1>`

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc29-ebd0-76bb-874a-cb9468713192","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-57-300Z_01a1dc29-ebd0-76bb-874a-cb9468713192.jsonl","header":{"type":"session","version":3,"id":"01a1dc29-ebd0-76bb-874a-cb9468713192","timestamp":"2026-11-14T22:24:57.300Z","cwd":"<tmp>/project","parentSession":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-38-530Z_01a1dc29-a27f-70c7-9502-b6feb03d432b.jsonl"},"entryTypes":["model_change","thinking_level_change","message","message","message","message","message","message","message"],"messageCount":7,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695095507.573,"timeOriginIso":"2026-11-14T22:24:55.507Z","now":1794695097530}
```

Reason `startup`; 7 `message` entries held.

### Launch 5: --continue (after the fork of launch 4)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc29-ebd0-76bb-874a-cb9468713192","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-57-300Z_01a1dc29-ebd0-76bb-874a-cb9468713192.jsonl","header":{"type":"session","version":3,"id":"01a1dc29-ebd0-76bb-874a-cb9468713192","timestamp":"2026-11-14T22:24:57.300Z","cwd":"<tmp>/project","parentSession":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-24-38-530Z_01a1dc29-a27f-70c7-9502-b6feb03d432b.jsonl"},"entryTypes":["model_change","thinking_level_change","message","message","message","message","message","message","message","message","message"],"messageCount":9,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695097624.395,"timeOriginIso":"2026-11-14T22:24:57.624Z","now":1794695099824}
```

Reason `startup`; 9 `message` entries held.

### Launch 6: no session flag (new session)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc29-fc7e-75aa-97c3-ea5d0ca5f3e1","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-01-570Z_01a1dc29-fc7e-75aa-97c3-ea5d0ca5f3e1.jsonl","header":{"type":"session","version":3,"id":"01a1dc29-fc7e-75aa-97c3-ea5d0ca5f3e1","timestamp":"2026-11-14T22:25:01.570Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695099910.35,"timeOriginIso":"2026-11-14T22:24:59.910Z","now":1794695101761}
```

Reason `startup`; no `message` entry held.

### Launch 7: --continue in the empty folder

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-045d-76dc-8c62-f7c2f5756f59","sessionFile":"<tmp>/agent/sessions/--<tmp>-empty--/2026-11-14T22-25-03-585Z_01a1dc2a-045d-76dc-8c62-f7c2f5756f59.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-045d-76dc-8c62-f7c2f5756f59","timestamp":"2026-11-14T22:25:03.585Z","cwd":"<tmp>/empty"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695101844.616,"timeOriginIso":"2026-11-14T22:25:01.844Z","now":1794695103843}
```

Reason `startup`; no `message` entry held.

### Launch 8a: --name spike-named (new session)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-4592-7435-a740-f5fcaa8bc7c1","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-20-279Z_01a1dc2a-4592-7435-a740-f5fcaa8bc7c1.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-4592-7435-a740-f5fcaa8bc7c1","timestamp":"2026-11-14T22:25:20.279Z","cwd":"<tmp>/project"},"entryTypes":["session_info","model_change","thinking_level_change"],"messageCount":0,"sessionName":"spike-named","modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695118580.16,"timeOriginIso":"2026-11-14T22:25:18.580Z","now":1794695120502}
```

Reason `startup`; no `message` entry held.

### Launch 8b: --continue (the named session)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-4592-7435-a740-f5fcaa8bc7c1","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-20-279Z_01a1dc2a-4592-7435-a740-f5fcaa8bc7c1.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-4592-7435-a740-f5fcaa8bc7c1","timestamp":"2026-11-14T22:25:20.279Z","cwd":"<tmp>/project"},"entryTypes":["session_info","model_change","thinking_level_change","message","message","message"],"messageCount":3,"sessionName":"spike-named","modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695120595.031,"timeOriginIso":"2026-11-14T22:25:20.595Z","now":1794695122567}
```

Reason `startup`; 3 `message` entries held.

### Launch 9: `--session <hand-written file>`

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-01T10-00-00-000Z_0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001.jsonl","header":{"type":"session","version":3,"id":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","timestamp":"2026-11-01T10:00:00.000Z","cwd":"<tmp>/project"},"entryTypes":["message","message","thinking_level_change"],"messageCount":2,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695139876.281,"timeOriginIso":"2026-11-14T22:25:39.876Z","now":1794695141670}
```

Reason `startup`; 2 `message` entries held.

### Launch 10: --continue (the hand-written file is the most recent)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-01T10-00-00-000Z_0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001.jsonl","header":{"type":"session","version":3,"id":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","timestamp":"2026-11-01T10:00:00.000Z","cwd":"<tmp>/project"},"entryTypes":["message","message","thinking_level_change","message","message","message"],"messageCount":5,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695141741.359,"timeOriginIso":"2026-11-14T22:25:41.741Z","now":1794695143482}
```

Reason `startup`; 5 `message` entries held.

### Launch 11: --mode rpc, no model flag, stdin closed (empty folder)

Exit status 0. Pi printed nothing on stdout. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2c-289a-729f-8bbc-5b1544fc53d7","sessionFile":"<tmp>/agent/sessions/--<tmp>-empty--/2026-11-14T22-27-23-933Z_01a1dc2c-289a-729f-8bbc-5b1544fc53d7.jsonl","header":{"type":"session","version":3,"id":"01a1dc2c-289a-729f-8bbc-5b1544fc53d7","timestamp":"2026-11-14T22:27:23.933Z","cwd":"<tmp>/empty"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695242138.719,"timeOriginIso":"2026-11-14T22:27:22.138Z","now":1794695244144}
```

Reason `startup`; no `message` entry held.

## Output: Pi 1.5.2

The same probe, stub model, runner, and launches, in a new temporary directory. Launches 8 to 11 were run as well.

### Launch 1: no session flag (new session, one prompt)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-cbf8-778f-a36d-91e634add9e9","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-54-682Z_01a1dc2a-cbf8-778f-a36d-91e634add9e9.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-cbf8-778f-a36d-91e634add9e9","timestamp":"2026-11-14T22:25:54.682Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695154087.262,"timeOriginIso":"2026-11-14T22:25:54.087Z","now":1794695155164}
```

Reason `startup`; no `message` entry held.

### Launch 2: --continue

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-cbf8-778f-a36d-91e634add9e9","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-54-682Z_01a1dc2a-cbf8-778f-a36d-91e634add9e9.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-cbf8-778f-a36d-91e634add9e9","timestamp":"2026-11-14T22:25:54.682Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change","message","message","message"],"messageCount":3,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695165799.831,"timeOriginIso":"2026-11-14T22:26:05.799Z","now":1794695166446}
```

Reason `startup`; 3 `message` entries held.

### Launch 3: `--session <file of launch 1>`

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-cbf8-778f-a36d-91e634add9e9","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-54-682Z_01a1dc2a-cbf8-778f-a36d-91e634add9e9.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-cbf8-778f-a36d-91e634add9e9","timestamp":"2026-11-14T22:25:54.682Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change","message","message","message","message","message"],"messageCount":5,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695166528.43,"timeOriginIso":"2026-11-14T22:26:06.528Z","now":1794695167202}
```

Reason `startup`; 5 `message` entries held.

### Launch 4: `--fork <file of launch 1>`

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-ff06-751b-bfb3-ed280be31bf9","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-26-07-753Z_01a1dc2a-ff06-751b-bfb3-ed280be31bf9.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-ff06-751b-bfb3-ed280be31bf9","timestamp":"2026-11-14T22:26:07.753Z","cwd":"<tmp>/project","parentSession":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-54-682Z_01a1dc2a-cbf8-778f-a36d-91e634add9e9.jsonl"},"entryTypes":["model_change","thinking_level_change","message","message","message","message","message","message","message"],"messageCount":7,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695167310.953,"timeOriginIso":"2026-11-14T22:26:07.310Z","now":1794695167947}
```

Reason `startup`; 7 `message` entries held.

### Launch 5: --continue (after the fork of launch 4)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2a-ff06-751b-bfb3-ed280be31bf9","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-26-07-753Z_01a1dc2a-ff06-751b-bfb3-ed280be31bf9.jsonl","header":{"type":"session","version":3,"id":"01a1dc2a-ff06-751b-bfb3-ed280be31bf9","timestamp":"2026-11-14T22:26:07.753Z","cwd":"<tmp>/project","parentSession":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-25-54-682Z_01a1dc2a-cbf8-778f-a36d-91e634add9e9.jsonl"},"entryTypes":["model_change","thinking_level_change","message","message","message","message","message","message","message","message","message"],"messageCount":9,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695168030.412,"timeOriginIso":"2026-11-14T22:26:08.030Z","now":1794695168700}
```

Reason `startup`; 9 `message` entries held.

### Launch 6: no session flag (new session)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2b-04ed-7138-a057-4a877351ad08","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-26-09-265Z_01a1dc2b-04ed-7138-a057-4a877351ad08.jsonl","header":{"type":"session","version":3,"id":"01a1dc2b-04ed-7138-a057-4a877351ad08","timestamp":"2026-11-14T22:26:09.265Z","cwd":"<tmp>/project"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695168807.266,"timeOriginIso":"2026-11-14T22:26:08.807Z","now":1794695169474}
```

Reason `startup`; no `message` entry held.

### Launch 7: --continue in the empty folder

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2b-07d1-7636-8376-c5b2b0f28a42","sessionFile":"<tmp>/agent/sessions/--<tmp>-empty--/2026-11-14T22-26-10-004Z_01a1dc2b-07d1-7636-8376-c5b2b0f28a42.jsonl","header":{"type":"session","version":3,"id":"01a1dc2b-07d1-7636-8376-c5b2b0f28a42","timestamp":"2026-11-14T22:26:10.004Z","cwd":"<tmp>/empty"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695169556.327,"timeOriginIso":"2026-11-14T22:26:09.556Z","now":1794695170195}
```

Reason `startup`; no `message` entry held.

### Launch 8a: --name spike-named (new session)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2b-0aca-7487-9468-b08b0dd967db","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-26-10-765Z_01a1dc2b-0aca-7487-9468-b08b0dd967db.jsonl","header":{"type":"session","version":3,"id":"01a1dc2b-0aca-7487-9468-b08b0dd967db","timestamp":"2026-11-14T22:26:10.765Z","cwd":"<tmp>/project"},"entryTypes":["session_info","model_change","thinking_level_change"],"messageCount":0,"sessionName":"spike-named","modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695170309.528,"timeOriginIso":"2026-11-14T22:26:10.309Z","now":1794695170951}
```

Reason `startup`; no `message` entry held.

### Launch 8b: --continue (the named session)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2b-0aca-7487-9468-b08b0dd967db","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-14T22-26-10-765Z_01a1dc2b-0aca-7487-9468-b08b0dd967db.jsonl","header":{"type":"session","version":3,"id":"01a1dc2b-0aca-7487-9468-b08b0dd967db","timestamp":"2026-11-14T22:26:10.765Z","cwd":"<tmp>/project"},"entryTypes":["session_info","model_change","thinking_level_change","message","message","message"],"messageCount":3,"sessionName":"spike-named","modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695171065.985,"timeOriginIso":"2026-11-14T22:26:11.065Z","now":1794695171721}
```

Reason `startup`; 3 `message` entries held.

### Launch 9: `--session <hand-written file>`

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-01T10-00-00-000Z_0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001.jsonl","header":{"type":"session","version":3,"id":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","timestamp":"2026-11-01T10:00:00.000Z","cwd":"<tmp>/project"},"entryTypes":["message","message","thinking_level_change"],"messageCount":2,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695171884.578,"timeOriginIso":"2026-11-14T22:26:11.884Z","now":1794695172555}
```

Reason `startup`; 2 `message` entries held.

### Launch 10: --continue (the hand-written file is the most recent)

Exit status 0. Pi printed: `stub reply`. Probe line:

```json
{"reason":"startup","sessionId":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","sessionFile":"<tmp>/agent/sessions/--<tmp>-project--/2026-11-01T10-00-00-000Z_0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001.jsonl","header":{"type":"session","version":3,"id":"0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001","timestamp":"2026-11-01T10:00:00.000Z","cwd":"<tmp>/project"},"entryTypes":["message","message","thinking_level_change","message","message","message"],"messageCount":5,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695172636.473,"timeOriginIso":"2026-11-14T22:26:12.636Z","now":1794695173300}
```

Reason `startup`; 5 `message` entries held.

### Launch 11: --mode rpc, no model flag, stdin closed (empty folder)

Exit status 0. Pi printed nothing on stdout. Probe line:

```json
{"reason":"startup","sessionId":"01a1dc2c-4ba0-70e2-aa9f-55037ec41650","sessionFile":"<tmp>/agent/sessions/--<tmp>-empty--/2026-11-14T22-27-32-900Z_01a1dc2c-4ba0-70e2-aa9f-55037ec41650.jsonl","header":{"type":"session","version":3,"id":"01a1dc2c-4ba0-70e2-aa9f-55037ec41650","timestamp":"2026-11-14T22:27:32.900Z","cwd":"<tmp>/empty"},"entryTypes":["model_change","thinking_level_change"],"messageCount":0,"modelId":"faux-1","thinkingLevel":"off","timeOrigin":1794695252382.138,"timeOriginIso":"2026-11-14T22:27:32.382Z","now":1794695253119}
```

Reason `startup`; no `message` entry held.

## Result

Every fact below is read from the output above, not from Pi's source. Both versions gave the same answer for every fact. `--resume` was not run: it opens a picker, which no script can drive. `--session <file>` stands for it (D-PG6-16).

Two more facts from the output bear on the rule. First, the `message` count includes a `message` entry with role `system`: Pi 1.5.0 and 1.5.2 write the system prompt as a `message` entry before the first user message (launch 1's file: `session`, `model_change`, `thinking_level_change`, `message` (system), `message` (user), `message` (assistant)). Pi writes it with the first prompt, so it is never the only `message` entry of a session that holds a saved turn. Second, the header `timestamp` is an ISO string in whole milliseconds, and `performance.timeOrigin` is a fractional epoch in milliseconds.

| Fact | Pi 1.5.0 | Pi 1.5.2 | Prediction (06-RESEARCH.md) | Holds |
| --- | --- | --- | --- | --- |
| Reason of `--continue` (launches 2, 5, 8b, 10) | `startup` | `startup` | `startup` (P1, A1) | yes |
| Reason of `--session <file>` (launches 3, 9) | `startup` | `startup` | `startup` (P1, A1) | yes |
| Reason of `--fork <file>` (launch 4) | `startup` | `startup` | `startup` (P1, A1) | yes |
| Reason of a new session (launches 1, 6, 7, 8a, 11) | `startup` | `startup` | `startup` (P1) | yes |
| `previousSessionFile` on every launch | absent | absent | not predicted | not predicted |
| A continued or opened session holds a `message` entry at `session_start` | yes: 3, 5, 9, 3, 2, and 5 entries in launches 2, 3, 5, 8b, 9, 10 | yes: the same counts | yes (F7, P2, A1) | yes |
| Entry types of a new session at `session_start` | `model_change`, `thinking_level_change` (launches 1, 6, 7, 11); `session_info`, `model_change`, `thinking_level_change` under `--name` (launch 8a); no `message` | the same | `model_change`, `thinking_level_change`, and `session_info` under `--name`; no `message` (F7, P2) | yes; `session_info` comes first, which the prediction did not state |
| Forked session (launch 4): header has `parentSession` | yes, the path of launch 1's file | yes | yes (F8, P3) | yes |
| Forked session (launch 4): header `timestamp` at or after `performance.timeOrigin` | yes, 1792 ms after | yes, 442 ms after | yes (F8, A2) | yes |
| Forked session (launch 4): `message` entries at `session_start` | 7, copied from launch 1's file | 7 | every entry copied (P3) | yes |
| Continued fork (launch 5): header still has `parentSession` | yes | yes | yes (F8) | yes |
| Continued fork (launch 5): header `timestamp` before `performance.timeOrigin` | yes, 324 ms before | yes, 277 ms before | yes (F8, A2) | yes |
| A new session: header `timestamp` against `performance.timeOrigin` | after it, by 1660 to 1900 ms (launches 1, 6, 7, 8a) | after it, by 448 to 595 ms | not predicted | not predicted; a new session also passes the "made in this launch" test, so the test separates forks only together with `parentSession` |
| `--continue` in a folder with no session (launch 7) | Pi starts a new session, no error, exit 0; entries as launch 6 | the same | as launch 6 (P3) | yes |
| Folder of a saved session file, relative to the agent directory | `sessions/--<cwd without its leading slash, each / replaced by ->--/` | the same | the directory for the working directory (Pitfall 4) | yes |
| Form of the file name | `<header timestamp, with : and . replaced by ->_<session id>.jsonl`, such as `2026-11-14T22-24-38-530Z_01a1dc29-a27f-70c7-9502-b6feb03d432b.jsonl` | the same | not predicted | not predicted |
| Pi opened the hand-written file with `--session` (launch 9) | yes: its id, its header, and its 2 `message` entries, and Pi appended a `thinking_level_change` | yes, the same | yes (A8) | yes |
| Pi opened the hand-written file with `--continue` (launch 10) | yes, as the file with the newest modification time, though its name and header carry the oldest timestamp | yes, the same | yes (A8) | yes |
| `ctx.model?.id` at `session_start` | `faux-1`, with `--provider faux --model faux-1` (launches 1 to 10) and with no model flag in RPC mode (launch 11, faux is the only provider with a key) | `faux-1` in both | not predicted | not predicted |
| `ctx.thinkingLevel` at `session_start` | `off` | `off` | not predicted | not predicted |
| `getSessionName()` at the `session_start` of the continued named session (launch 8b) | `spike-named` | `spike-named` | present (Open Question 5) | yes |

### For plan 06-03: `resume`

The output supports this rule: a launch whose reason is `startup` and whose `ctx.sessionManager.getEntries()` holds at least one entry of type `message` at `session_start` continues a saved session, so `SessionStart` gets `resume`, unless the fork rule below applies. Launches 2, 3, 5, 8b, 9, and 10 hold 2 to 9 `message` entries; launches 1, 6, 7, 8a, and 11 hold none, though each holds two or three other entries, so a count of all entries would report `resume` on every launch (F7). The entries are loaded when the event fires on both versions, so the rule needs no file read and no command-line parse.

### For plan 06-03: `fork`

The output supports this rule: a launch whose reason is `startup`, whose header has `parentSession`, and whose header `timestamp` is not earlier than `performance.timeOrigin` made a fork in this launch, so `SessionStart` gets `fork`. Launch 4 passes on both versions (1792 ms and 442 ms after the start). Launch 5, the same fork continued, keeps `parentSession` and fails the time test (324 ms and 277 ms before the start), so it gets `resume`; this is the guard against Pitfall 5. A new session also has a header timestamp after the start (launches 1, 6, 7, 8a), so the time test alone does not mark a fork; `parentSession` is required. The fork holds the copied `message` entries (7 in launch 4), so the fork test must run before the `resume` test. The margin in launch 5 was a few hundred milliseconds only because the launches ran back to back: the header of an older fork was written by an earlier process before this process started, and whole-millisecond truncation only moves it earlier.

### For plan 06-03: the saved session of a scenario

A file written by hand works on both versions: Pi opened it with `--session` (launch 9) and found it with `--continue` (launch 10). The file needs a `session` header with `version` 3, an `id`, a `timestamp`, and the `cwd` of the launch, then a user and an assistant `message` entry chained by `id` and `parentId`, as shown under Commands. For `--continue`, it must lie in `<agent>/sessions/--<encoded cwd>--/` and be the file there with the newest modification time; Pi does not order by the name or the header timestamp. A header-only file, as the existing `Given` in `session-end.steps.ts` writes, was not run; under the `resume` rule above it would report `startup`, because it holds no `message` entry. No launch contradicted a prediction of 06-RESEARCH.md.
