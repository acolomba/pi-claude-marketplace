import assert from "node:assert/strict";
import test from "node:test";

import {
  installTimerLadder,
  type ChildLike,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts";

/**
 * EXEC-02: SIGTERM -> 5s grace -> SIGKILL ladder. Tests use
 * `t.mock.timers` to drive the two `setTimeout` callbacks without real
 * elapsed time, and a spy `kill` to record which signals fire under
 * each scenario. TOCTOU: the exit-state guard prevents a phantom
 * kill against a recycled pid when the natural-exit `cancel()` arrives
 * after the timer has been scheduled but before it fires. The guard reads
 * exit state, not `child.killed` -- `killed` means "we sent a signal", which
 * is true of a child that trapped SIGTERM and is still running.
 *
 * The ladder takes SECONDS and owns the bridge's only conversion to the
 * milliseconds `setTimeout` wants, so the ticks below are milliseconds
 * while the arguments are seconds.
 */

interface SpyChild extends ChildLike {
  /**
   * Not read by the ladder, which guards on exit state. Kept and maintained
   * because `ChildProcess` sets it on `kill()`, and a spy that silently
   * diverged from Node here is what let the dead SIGKILL escalation survive.
   */
  killed: boolean;
  readonly killCalls: NodeJS.Signals[];
}

/**
 * Faithful to `ChildProcess` in the field the ladder branches on: `kill()`
 * sets `killed = true` because Node does, and it does NOT set `exitCode` --
 * sending a signal is not the child dying. A spy that left `killed` false let
 * the SIGKILL assertions below pass against a branch production could never
 * reach, which is how the dead escalation survived.
 */
function makeSpyChild(): SpyChild {
  const killCalls: NodeJS.Signals[] = [];
  const spy: SpyChild = {
    killed: false,
    exitCode: null,
    signalCode: null,
    killCalls,
    kill(signal): boolean {
      killCalls.push(signal ?? "SIGTERM");
      spy.killed = true;
      return true;
    },
  };
  return spy;
}

test("installTimerLadder: SIGTERM fires at timeoutSeconds (no kill before then)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1, "acme/PreToolUse");

  // Just before SIGTERM -- no kill yet.
  t.mock.timers.tick(999);
  assert.deepEqual(child.killCalls, []);

  // Exactly at SIGTERM -- one SIGTERM kill.
  t.mock.timers.tick(1);
  assert.deepEqual(child.killCalls, ["SIGTERM"]);
});

test("installTimerLadder: SIGKILL fires 5s after SIGTERM", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1, "acme/PreToolUse");

  // Advance past SIGTERM.
  t.mock.timers.tick(1_000);
  assert.deepEqual(child.killCalls, ["SIGTERM"]);

  // Advance the 5s grace. SIGKILL fires.
  t.mock.timers.tick(5_000);
  assert.deepEqual(child.killCalls, ["SIGTERM", "SIGKILL"]);
});

test("installTimerLadder: cancel() before any timer fires -> zero kill calls", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  const ladder = installTimerLadder(child, 1, "acme/PreToolUse");
  ladder.cancel();

  // Advance well past both timers.
  t.mock.timers.tick(10_000);
  assert.deepEqual(child.killCalls, []);
});

test("installTimerLadder: TOCTOU defense -- a child that already exited gets no kill", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1, "acme/PreToolUse");

  // Natural exit just before the timer fires. Expressed as exit state, not as
  // `killed`: `killed` means "we sent a signal", so it is true of a child that
  // trapped SIGTERM and is still running -- the case the SIGKILL leg exists for.
  child.exitCode = 0;

  t.mock.timers.tick(1_000);
  assert.deepEqual(
    child.killCalls,
    [],
    "TOCTOU guard prevents phantom SIGTERM against a child that already exited",
  );

  t.mock.timers.tick(5_000);
  assert.deepEqual(
    child.killCalls,
    [],
    "TOCTOU guard also prevents phantom SIGKILL on the same already-exited child",
  );
});

test("installTimerLadder: a timeout past setTimeout's int32 ceiling is clamped, not truncated", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  // 3_600_000 is "1 hour" written in MILLISECONDS -- the shape an author
  // wrote to suit the bridge before it read the field as seconds. Reading
  // it as seconds is what puts the value out of range; the clamp is what
  // keeps it usable. Unclamped, seconds * 1000 exceeds what setTimeout can
  // represent, so Node replaces the delay with 1 ms (emitting a
  // TimeoutOverflowWarning) and the child is SIGTERM'd at spawn.
  installTimerLadder(child, 3_600_000, "acme/PreToolUse");

  // The clamp is (2^31-1 ms) floored to whole seconds, less the 5 s grace,
  // so the SIGKILL leg stays representable too.
  t.mock.timers.tick(2_147_477_999);
  assert.deepEqual(child.killCalls, [], "clamped SIGTERM must not fire early");

  t.mock.timers.tick(1);
  assert.deepEqual(child.killCalls, ["SIGTERM"], "SIGTERM fires at the clamped ceiling");

  t.mock.timers.tick(5_000);
  assert.deepEqual(
    child.killCalls,
    ["SIGTERM", "SIGKILL"],
    "the 5 s grace survives the clamp -- SIGKILL is not co-scheduled with SIGTERM",
  );
});

test("installTimerLadder: 0 seconds keeps the 5 s SIGKILL leg (the overflow re-arm)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  // `dispatch-exec.ts` re-arms with 0 after sending SIGTERM itself on a stdout
  // overflow, so the ladder exists only for the escalation. Treating 0 as
  // degenerate would push that SIGKILL out to the ceiling and let a child that
  // ignores SIGTERM survive indefinitely.
  installTimerLadder(child, 0, "acme/PreToolUse");

  t.mock.timers.tick(0);
  assert.deepEqual(child.killCalls, ["SIGTERM"], "0 s means fire now, not never");

  t.mock.timers.tick(5_000);
  assert.deepEqual(child.killCalls, ["SIGTERM", "SIGKILL"], "the 5 s grace still follows");
});

test("installTimerLadder: non-finite and negative inputs degrade to the ceiling, not to 1 ms", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // setTimeout coerces NaN and negatives to 1 ms, which would SIGTERM at spawn
  // -- the exact failure this module exists to prevent. The guard is here
  // rather than only in the caller because this function is exported.
  // Number.POSITIVE_INFINITY is deliberately absent: mock timers store an
  // expiry no tick can reach for it, so including it would assert nothing.
  for (const degenerate of [Number.NaN, -1]) {
    const child = makeSpyChild();
    installTimerLadder(child, degenerate, "acme/PreToolUse");

    t.mock.timers.tick(1);
    assert.deepEqual(child.killCalls, [], `${String(degenerate)} must not kill at spawn`);

    // Pin WHERE it degrades to, not merely that it is not immediate. A future
    // edit degrading to a short budget would otherwise pass, and short is the
    // dangerous direction.
    // The tick(1) above already counted toward the ceiling.
    t.mock.timers.tick(2_147_477_998);
    assert.deepEqual(child.killCalls, [], `${String(degenerate)} must reach the ceiling`);
    t.mock.timers.tick(1);
    assert.deepEqual(child.killCalls, ["SIGTERM"], `${String(degenerate)} fires at the ceiling`);
  }
});

test("installTimerLadder: a fired leg names the plugin, event and budget on the debug channel", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const prev = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  const original = console.error;
  const lines: string[] = [];
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  console.error = (...args: unknown[]): void => {
    lines.push(args.join(" "));
  };

  try {
    const child = makeSpyChild();
    installTimerLadder(child, 2, "acme/SessionEnd");
    t.mock.timers.tick(2_000);
    t.mock.timers.tick(5_000);
  } finally {
    console.error = original;
    if (prev === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = prev;
    }
  }

  // These two lines are the ONLY signal that a hook died of its timeout: the
  // wire protocol maps a signal-kill to a bare noop, and EXEC-03 forbids
  // ctx.ui.notify in this lane.
  assert.equal(lines.length, 2, "both legs report");
  assert.match(lines[0] ?? "", /SIGTERM after 2s \(acme\/SessionEnd\)/);
  assert.match(lines[1] ?? "", /SIGKILL after 7s \(acme\/SessionEnd\)/);
});

test("installTimerLadder: a child terminated by a signal is also seen as exited", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1, "acme/PreToolUse");

  // A signalled child reports `exitCode === null` and `signalCode` set, so an
  // exitCode-only predicate would read it as still running -- and the SIGKILL
  // leg would then log "the child ignored SIGTERM" about a child that obeyed.
  child.signalCode = "SIGTERM";

  t.mock.timers.tick(1_000);
  t.mock.timers.tick(5_000);
  assert.deepEqual(child.killCalls, [], "signalCode alone must suppress both legs");
});

test("installTimerLadder: the label reaches the emitted lines verbatim", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const prev = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  const original = console.error;
  const lines: string[] = [];
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  console.error = (...args: unknown[]): void => {
    lines.push(args.join(" "));
  };

  try {
    const child = makeSpyChild();
    installTimerLadder(child, 1, "labelled/PostToolUse");
    t.mock.timers.tick(1_000);
  } finally {
    console.error = original;
    if (prev === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = prev;
    }
  }

  assert.match(lines[0] ?? "", /\(labelled\/PostToolUse\)/);
});
