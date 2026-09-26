// Drive the REAL @nicknisi/pi-workflows engine over a fixture.
//
//   npm install @nicknisi/pi-workflows@0.2.1
//   node run.mjs                             # probe.workflow.js
//   node run.mjs determinism.workflow.js     # all three succeed (no guard)
//   node run.mjs agent-failure.workflow.js   # agent() throws, does not yield null
//
// The engine's dist is imported by file path: its package.json `exports` map
// publishes only ".", so a subpath specifier fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
import { readFileSync } from 'node:fs';

import { runScript } from './node_modules/@nicknisi/pi-workflows/dist/engine.js';

const fixture = process.argv[2] ?? 'probe.workflow.js';
const script = readFileSync(new URL(fixture, import.meta.url), 'utf8');

// Stub spawn. probe/determinism never call agent(); agent-failure.workflow.js
// does, and this returns the engine's documented EngineSpawnFail shape so the
// null-vs-throw question is answered by the engine, not by a malformed stub.
const zeroUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
const spawn = async () => ({ ok: false, kind: 'api_error', error: 'simulated failure', text: '', usage: zeroUsage });

const res = await runScript({ script, spawn, cwd: process.cwd() });

console.log(JSON.stringify({ engine: '@nicknisi/pi-workflows', fixture, result: res.value, meta: res.meta }, null, 2));
