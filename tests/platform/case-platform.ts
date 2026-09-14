// tests/platform/case-platform.ts
//
// One-case `process.platform` stub, shared by every suite that needs to
// observe platform-dependent behavior.
//
// The own property is non-writable, so a plain assignment silently does
// nothing: `Object.defineProperty` is the only way in, and restoring the
// captured descriptor through `t.after()` is the only way back.
//
// The stub mutates a process global, so a case that calls it must not run
// concurrently with another case that also mutates `process.platform`.

import type { TestContext } from "node:test";

export function setCasePlatform(t: TestContext, platform: NodeJS.Platform): void {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  if (descriptor === undefined) {
    throw new Error("process.platform descriptor is unavailable");
  }

  t.after(() => {
    Object.defineProperty(process, "platform", descriptor);
  });
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
}
