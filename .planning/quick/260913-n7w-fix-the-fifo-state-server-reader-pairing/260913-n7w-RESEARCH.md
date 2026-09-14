# 260913-n7w: Fix the FIFO state-server reader pairing — Research

**Researched:** 2026-09-13
**Domain:** POSIX FIFO semantics, Node `fs.promises` file I/O, cross-process test synchronization
**Confidence:** HIGH — every load-bearing claim below was reproduced on this machine with a probe whose output is pasted inline.

## Summary

`tests/orchestrators/plugin/state-fifo.ts` rests on a stated invariant that is false. Its header
claims "Each open pairs exactly one reader with one writer." A FIFO has no such pairing. `fifo(7)`
is explicit that the kernel keeps **one** pipe object per FIFO, shared by every open of that inode.
EOF is therefore a property of the inode's writer count, not of a particular open, and the serve
loop's next `open(fifoPath, "w")` revives that count — cancelling the EOF the previous reader was
about to observe and feeding it a second payload through the same `readFile` call.

I reproduced the failure with the real `readFile`: **10 failures in 80 runs** under CPU saturation,
error `Unexpected non-whitespace character after JSON at position 475`, which is the byte-for-byte
shape of the reported `position 496`. I also confirmed the user's ENXIO analysis is correct in its
conclusion but wrong about the dominant failure mode: ENXIO polling fails **17 in 100** under the
same load, and it fails by handing a parked reader an **empty** payload, not by hanging.

The fix that survives is to retire each FIFO inode from the namespace — `rename` a fresh FIFO over
the path — *while the server still holds that inode open for write*. The reader keeps its fd and
still receives its payload, but no later open of the path can ever reach the retired inode, so its
EOF is guaranteed. **160/160 under the same saturation that breaks the current design.** The change
is confined to `state-fifo.ts`; neither consuming test is touched, and the header's "nothing here
polls, sleeps, or retries" property is preserved exactly.

**Primary recommendation:** Retire-by-rename inside the write-open window (Design C below). Gate it
with a deterministic adversarial-reader test, not with a soak run.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Payload/reader pairing | Test harness (`state-fifo.ts` server child) | — | The reader is production code and must stay unmodified; only the server can own the ordering. |
| Blocking happens-before | OS kernel (FIFO open rendezvous) | — | The whole point of the harness is an OS-enforced barrier rather than a sleep. |
| Inode lifecycle / namespace swap | Test harness (server child) | — | `rename` is the only atomic way to vary the inode behind a fixed path. |
| Read-count assertion | Consuming tests (`messages` deepEqual) | Harness (`served:N`) | Unchanged; see the caveat in "Invariant that is not actually enforced". |

## Project Constraints (from CLAUDE.md)

- `npm run check` must stay green: typecheck + ESLint + `fallow` (dead-code, health, duplication) +
  Prettier + unit + integration tests (NFR-6).
- Comments and test titles cite durable spec IDs only; no GSD phase/plan/wave references
  `[VERIFIED: .claude/rules/typescript-comments.md]`.
- Read before editing; trace callers before modifying a function.
- Run `pre-commit run --all-files` before `git commit`; never `--no-verify`.

Two repo gates bear directly on where a new test file may live:

- `[VERIFIED: scripts/check-corresponding-tests.mjs:10]` —
  `const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration", "scripts"]);`
- `[VERIFIED: scripts/check-corresponding-tests.mjs:166-170]` —
  ```js
      const sourcePath = expectedSourcePath(testPath);

      if (!sourceSet.has(sourcePath)) {
        violations.push({ kind: "unexpected-test", path: testPath });
      }
  ```
  A file at `tests/orchestrators/plugin/state-fifo.test.ts` would demand a production module at
  `extensions/pi-claude-marketplace/orchestrators/plugin/state-fifo.ts`, which does not exist, and
  would fail `npm run test:corresponding` with `unexpected-test`. The new gate must live under
  `tests/architecture/`, `tests/integration/`, `tests/e2e/`, or `tests/scripts/`.

## 1. FIFO semantics — the exact rules

All three quotes are from the man pages installed on this machine (Linux man-pages 6.13, kernel
`7.1.8-200.fc44.x86_64`).

**One pipe object per FIFO, not one per open.** `[VERIFIED: man 7 fifo, DESCRIPTION]`

> The kernel maintains exactly one pipe object for each FIFO special file that is opened by at
> least one process. The FIFO must be opened on both ends (reading and writing) before data can be
> passed. Normally, opening the FIFO blocks until the other end is opened also.

This single sentence refutes the header's pairing claim. Two sequential write-opens of the same
FIFO path are two references to *the same buffer*, not two channels.

**EOF is a writer-count property.** `[VERIFIED: man 7 pipe, DESCRIPTION]`

> If all file descriptors referring to the write end of a pipe have been closed, then an attempt to
> read(2) from the pipe will see end-of-file (read(2) will return 0).

"All … have been closed" is evaluated at the moment of the `read(2)`, not latched at the earlier
close. A writer that re-opens before the reader's next `read()` restores the condition and the read
blocks instead of returning 0.

**`O_NONBLOCK | O_WRONLY` and ENXIO.** `[VERIFIED: man 2 open, ERRORS]`

> ENXIO  O_NONBLOCK | O_WRONLY is set, the named file is a FIFO, and no process has the FIFO open
> for reading.

Note what this does **not** say: it says nothing about whether a process *blocked inside*
`open(O_RDONLY)` counts as having the FIFO open for reading. That gap is the whole ENXIO question,
and the man page cannot answer it. Section 3 answers it by probe.

**Write atomicity.** `[VERIFIED: man 7 pipe, PIPE_BUF]` — "POSIX.1 says that writes of less than
PIPE_BUF bytes must be atomic … (On Linux, PIPE_BUF is 4096 bytes.)" The payloads here are ~475–500
bytes, so a payload is never torn. Pipe capacity is 65,536 bytes, so `writeFile` never blocks on
these payloads either. Neither fact is load-bearing for the bug — the concatenation happens in the
*reader's* loop, not in the write.

## 2. What Node actually does

**`fsPromises.open(path, "w")` on a FIFO.** The `"w"` string maps to `O_WRONLY | O_CREAT | O_TRUNC`
`[ASSUMED]` — I did not read Node's flag table this session, but the blocking behavior the file
assumes is real and observed: the server's `open` demonstrably parks until a reader arrives (probe
output in section 4 shows the server sitting at `served:1` with reader 2 never issued).

Two properties of `"w"` are hazards worth removing:

- `O_CREAT` means that if the path is ever missing, the server **silently creates a regular file**
  and writes into it. Every subsequent read then succeeds without blocking, the barrier evaporates,
  and the test becomes nondeterministic while still passing most of the time. Passing the numeric
  `constants.O_WRONLY` instead turns a missing path into a loud `ENOENT`.
- `O_TRUNC` is meaningless on a FIFO and is noise.

**`fsPromises.readFile(path)` is the reader.** `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:381-391]`

```ts
  let raw: string;
  try {
    raw = await readFile(stateJsonPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Missing file -> default state (NOT throw).
      return { schemaVersion: 2, marketplaces: {} };
    }
```

Two things follow. First, `readFile` on a path is `open()` → `fstat()` → a `read()` loop that
terminates on `bytesRead === 0`; each step is a separate libuv threadpool dispatch with an
event-loop turn between them, which is where the reader can be descheduled. Second — and this
constrains the design space hard — **an ENOENT on this path is silently converted into an empty
default state**. Any candidate design that leaves the path momentarily absent (unlink + mkfifo)
produces a *silently wrong* test result rather than a failure. Only `rename`, which is atomic, is
admissible.

**`O_NONBLOCK` is reachable from Node.** `fs.constants.O_NONBLOCK` exists and `openSync(fifo,
O_WRONLY | O_NONBLOCK)` behaves per the man page — verified by probe in section 3.

## 3. The ENXIO analysis — confirmed, and worse than stated

**The hazard is real.** A reader blocked inside `open(O_RDONLY)` does suppress ENXIO.
`[VERIFIED: probe output, this session]`

```
control (no reader)  : O_WRONLY|O_NONBLOCK failed with ENXIO
reader open() returned? false  (expect false = still blocked in open)
blocked reader parked: O_WRONLY|O_NONBLOCK SUCCEEDED (no ENXIO)
```

The negative control fires ENXIO, so the probe is measuring the right thing. With a reader parked
in a blocking `open` that has not returned, the same probe succeeds. The server therefore cannot
distinguish "previous reader still draining" from "next reader already waiting", exactly as
predicted. The kernel-level explanation is that `fifo_open` increments `pipe->readers` before it
sleeps in `wait_for_partner` `[ASSUMED — I did not read fs/pipe.c this session]`; the observable
behavior above needs no such appeal.

**But the dominant failure mode is not the hang.** The ENXIO probe is *destructive*: it opens a
writer and closes it, which delivers a zero-byte EOF to whoever is parked.
`[VERIFIED: probe output, this session]`

```
before probe, readFile result: <pending>
after  probe, readFile result: ""
```

`JSON.parse("")` throws `Unexpected end of JSON input`. Under the same 64-way saturation used
throughout this document, ENXIO polling failed **17 of 100 runs**, every one of them with that
error `[VERIFIED: probe output, this session]`:

```
enxio under load: pass=83 fail=17
   17x  FAIL err=Unexpected end of JSON input
```

So ENXIO polling is not merely "unsafe in a narrow window"; measured head to head it is **worse
than the bug it would replace** (17% vs 12.5%), and it converts a loud parse failure into a
different loud parse failure rather than fixing anything. Refuted as a candidate.

## 4. The bug, reproduced

**Mechanism, deterministically.** `readFile` is `open` → `fstat` → `read` loop. Widen the gap
between the reader's `open` and its drain — which is exactly what a loaded scheduler does — and the
outcome becomes certain rather than rare `[VERIFIED: probe output, this session]`:

```
=== current ===
  reader#1 got 950 bytes (one payload = 475)
  server messages at this point: ["ready","served:1","served:2","done"]
  JSON.parse -> Unexpected non-whitespace character after JSON at position 475 (line 2 column 1)
=== swap ===
  reader#1 got 475 bytes (one payload = 475)
  server messages at this point: ["ready","served:1"]
  JSON.parse -> OK, tag=1
```

**With the real `readFile`, under load.** 64 CPU burners on a 28-core box, 80 runs
`[VERIFIED: probe output, this session]`:

```
current under load: pass=70 fail=10 last='FAIL err=Unexpected non-whitespace character after JSON
  at position 475 (line 2 tags=[] msgs=["ready","served:1","served:2"] exit={"code":0,"signal":null}'
```

Unloaded, and even pinned to a single core with `taskset -c 0`, the same code passed 40/40 and
60/60. That is why 25/25 proved nothing.

### The invariant that is not actually enforced

Look again at the failing run's message log: `msgs=["ready","served:1","served:2"]`, `exit=0`. The
server reported serving both payloads and exited clean **while only one reader ever existed**. The
header's second stated invariant —

> the server exits 0 only after serving EVERY payload, so `served:N` message count is the
> orchestrator's exact read count

— is false under the bug. `served:N` counts the server's *write-opens*, which the bug decouples
from reads. The consuming tests' `assert.deepEqual(stateServer.messages, ["ready", "served:1",
"served:2"], "reinstall must read state.json exactly twice")` passes in the failing case. The only
thing that catches the bug today is `JSON.parse` choking downstream. Worth recording: after the
fix, that assertion becomes true again, because a write-open can no longer complete without a
distinct reader on a distinct inode.

### Why it looks fine most of the time

The serve loop happens to give the reader a head start:

```js
  await handle.close();
  served += 1;
  await announce(`served:${served}`);   // <- an IPC round-trip, then the next open()
```

That `await announce(...)` is an accidental delay, not a barrier. It buys the reader a couple of
event-loop turns, which is usually enough. Nothing in the design depends on it and nothing
guarantees it.

## 5. Candidate designs and their failure modes

| # | Design | Failure mode | Verdict |
|---|--------|--------------|---------|
| A | **Status quo** — reopen for write immediately | Second write-open revives the writer count before the reader's EOF read; reader gets two payloads concatenated. **Measured 10/80 under load.** Silent in the `served:N` log. | Broken |
| B | **ENXIO polling** — probe `O_WRONLY\|O_NONBLOCK` until ENXIO before reopening | Two modes. (i) The probe is destructive: it hands a parked reader an empty payload → `Unexpected end of JSON input`. **Measured 17/100 under load.** (ii) A reader blocked in `open` suppresses ENXIO, so the loop can spin to the 30 s watchdog. Also violates "nothing polls". | Refuted — worse than A |
| C | **Retire-by-rename inside the write-open window** — after the write-open pairs with a reader, `rename` a pre-created spare FIFO over the path *before* writing and closing | None found. Proof in section 6. **Measured 160/160 under the load that breaks A.** One extra `rename` syscall per payload; no poll, no sleep, no retry. | **Recommended** |
| C′ | Same, but rename *after* `close()` | Reopens the window at the other end: reader 2 can open the old inode between the close and the rename, then both sides park forever → 30 s watchdog, exit 2. | Rejected |
| D | **Unlink + mkfifo between payloads** | Non-atomic. The path is briefly absent, and `loadState` maps `ENOENT` to `DEFAULT_STATE` without throwing (state-io.ts:385-388), so the test gets a **silently wrong** empty state instead of a failure. | Rejected — silent |
| E | **Swap in a regular file for the last payload** | Removes the blocking barrier for that read, and breaks the `stat(path).isFIFO()` no-mutation assertion both consuming tests rely on. | Rejected |
| F | **Out-of-band handshake** (server waits for the parent to confirm read 1 finished) | The parent cannot observe `loadState` returning — it is buried inside an awaited orchestrator call. The only seam is `stateTransaction.loadState`, and using it replaces the production reader, which is the one thing out of scope. | Not available |
| G | **inotify on the FIFO** (`fs.watch` for the reader's close) | Node's inotify mask has no `IN_CLOSE_NOWRITE`, so the event is unobservable without native code. Even with it, the notification is after the fact and races reader 2 — the same hazard class as B. | Not available |
| H | **Hold `O_RDWR` open** (Linux allows it with no peer, per fifo(7)) | An `O_RDWR` fd counts as a writer for as long as it is held, so no reader ever sees EOF. Strictly worse. | Rejected |
| I | **Serve from the test process instead of a child** | Both ends of a FIFO in one process; `fifo(7)` warns about deadlock, and the blocking opens consume libuv threadpool slots shared with the orchestrator under test. | Rejected |
| J | **Abandon FIFOs** — Unix socket / FUSE / device node at the path | `readFile` on a Unix socket fails with `ENXIO` (`man 2 open`), FUSE needs the daemon installed, device nodes need root. No other filesystem object gives a blocking open on a fixed path. | Not available |

## 6. Recommended design, with its correctness argument

### Mechanism

```
   path ──► inode A                      server holds A open for write
              ▲                                   │
         reader 1 opens ───── rendezvous ─────────┤
                                                  │  rename(spare, path)
   path ──► inode B          inode A (retired)    │  ← namespace swapped here
                                   ▲              │
                                   └── payload 1 ─┘  write + close
                                        EOF guaranteed: nothing can reopen A
              ▲
         reader 2 opens ───── rendezvous ──────► inode B ...
```

### Proof that reader *k+1* can never attach to the inode serving reader *k*

1. The server holds inode *k* open for write from before the rename until after `writeFile`.
2. The `rename` happens while (1) holds.
3. Reader *k*'s `readFile` returns only at EOF. EOF requires `writers(inode k) == 0`. The server is
   the only process that ever opens inode *k* for write, and only in iteration *k*. So reader *k*
   cannot return before the server's `close()` in iteration *k*, which is after the rename.
4. Reader *k+1* is issued only after reader *k* returns — the two `loadState` calls are sequential
   awaits in one async flow.
5. Therefore reader *k+1*'s `open` resolves the path *after* the rename, reaching inode *k+1*. ∎

Step 4 is the design's one precondition: **no two concurrent readers of the same path.** It holds
here. The `Promise.all([loadState(project), loadState(user)])` call sites in
`orchestrators/plugin/shared.ts:303`, `:875`, and `reinstall-targets.ts:113`, `:176` read two
*different* paths, and only the project path is a FIFO in these tests. And a violation would be
loud rather than silent: two readers sharing one inode means one gets the payload and the other
gets zero bytes, which fails `JSON.parse`, and `served:N` would come up short against the tests'
`deepEqual` on `messages`.

### Server source

```js
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { open, rename } from "node:fs/promises";

const { O_WRONLY } = constants;
const fifoPath = process.env.PI_CM_FIFO_PATH;
const payloads = JSON.parse(process.env.PI_CM_FIFO_PAYLOADS);
let served = 0;

// One spare FIFO per payload, pre-created as a sibling of the state path so
// the handoff below is a single atomic rename() and no fork happens while a
// reader is parked. rename() requires the same filesystem; a sibling is one.
const spares = payloads.map((_, index) => `${fifoPath}.spare-${index}`);
for (const spare of spares) {
  execFileSync("mkfifo", [spare]);
}

// ... watchdog and announce() unchanged ...
await announce("ready");

for (const payload of payloads) {
  // Blocks until a reader opens whichever FIFO inode currently sits at
  // fifoPath. Bare O_WRONLY, never "w": O_CREAT would silently put a regular
  // file at a missing path and dissolve the barrier, where ENOENT is loud.
  const handle = await open(fifoPath, O_WRONLY);

  // Retire that inode from the namespace while still holding it open for
  // write. The paired reader keeps its fd and still gets this payload, but no
  // later open of fifoPath can reach the inode again -- so its EOF cannot be
  // cancelled by the next iteration's write-open.
  await rename(spares[served], fifoPath);

  await handle.writeFile(payload);
  await handle.close();
  served += 1;
  await announce(`served:${served}`);
}
```

The rename goes **before** the write, not after. Before-write is provably safe (step 3) and stays
safe if a payload ever exceeds the 64 KiB pipe capacity, where `writeFile` would block on reader
progress; after-write and after-close are design C′, which reopens the window.

### Header rewrite

The false sentence must go. Suggested replacement for lines 13–18, preserving the closing claim:

```
// A FIFO turns the ordering into an OS-enforced happens-before. `readFile`
// on a FIFO blocks in `open(O_RDONLY)` until a writer opens, and returns only
// at EOF -- when the last writer closes.
//
// EOF is a property of the pipe INODE, not of one open: the kernel keeps
// exactly one pipe object per FIFO, so a second write-open of the same inode
// revives the writer count and cancels the EOF the previous reader was about
// to see, delivering it two payloads in one read. The server therefore
// retires each inode from the namespace -- rename a fresh FIFO over the path
// -- while it still holds that inode open for write. The paired reader keeps
// its fd and still gets its payload; nothing can reopen the retired inode, so
// its EOF is guaranteed and payload k reaches read k, whatever the scheduler
// does. Nothing here polls, sleeps, or retries.
```

## 7. Does this preserve "nothing here polls, sleeps, or retries"?

**Yes, exactly.** Design C adds one `rename()` syscall per payload and removes nothing. There is no
loop, no timer, no backoff. The only sleep anywhere in the proposal is inside the *new regression
test's* adversarial reader (section 9), where a bounded stall is the point of the test rather than a
wait for convergence.

Had no such design existed, the honest recommendation would have been ENXIO polling with a bounded
retry and an explicit comment retracting the header claim — a correct-but-polling harness beats a
race-free-on-paper one. That tradeoff does not have to be made here.

## 8. Blast radius — does the fix cover both consumers?

**Yes, and neither test file changes.** `[VERIFIED: tests/orchestrators/plugin/reinstall-flow.test.ts:4931-5010, tests/orchestrators/plugin/uninstall.test.ts:1696-1775]`

| | `reinstall-flow.test.ts` | `uninstall.test.ts` |
|---|---|---|
| Test | "a marketplace removed between scope resolution and enumeration reports not added" | "WR-06 uninstall orchestrated mode — marketplace removed after resolution converges without mutation" |
| Payloads | `[presentState, removedState]` | `[presentState, removedState]` |
| Reads | unlocked scope resolution, then enumeration | unlocked cross-scope resolution, then locked re-load |
| Exposure | identical | identical |

Both call the same four exported entry points — `FIFO_SKIP`, `createStateFifo`,
`serializedStateBytes`, `startFifoStateServer` — and consume the same `FifoStateServer` surface
(`ready`, `complete`, `messages`, `stderr()`, `kill()`). Design C changes only the `SERVER_SOURCE`
template literal. No signature moves, so both tests are covered without being touched.

`state-fifo.ts` is the only `mkfifo` user in the repo `[VERIFIED: grep -rn "mkfifo" tests/ scripts/,
this session]` — two hits, both in that file. `tests/integration/load-reconcile-race.test.ts`, which
the same commit touched, uses a different technique and has no FIFO exposure. There is no third
consumer.

Nothing in production enumerates `extensionRoot` itself — every `readdir` call site targets a
subdirectory (`pluginClonesDir`, `resources/skills`, `resources/prompts`, `hooks/`, `data/`)
`[VERIFIED: grep -rn "readdir|opendir" extensions/, this session]` — so the transient
`state.json.spare-N` siblings are invisible to the code under test. Consider naming them
`.state-fifo-spare-N` to match the hidden-sibling precedent of `.state-lock`
`[VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:47]` —
`/** `<extensionRoot>/.state-lock` -- per-scope cross-process lock sentinel. */`.

## 9. Verification strategy

**The constraint is the whole problem.** The current test passes 25/25 unloaded and 40/40 pinned to
one core. A verification that runs the happy path N times proves nothing, and one that ships 64 CPU
burners inside `npm run check` is both slow and a bad citizen on a shared runner.

**Do not try to reproduce the race. Make the window certain.** The harness's real contract is *one
payload per reader-open*. Test that directly, with a reader that holds its fd open across an
explicit gap — the same interleaving a loaded scheduler produces occasionally, made unconditional.

Measured determinism of this gate, 20 runs per design in each condition
`[VERIFIED: probe output, this session]`:

```
unloaded:
  current -> 950 950 950 ... (20x)          swap -> 475 475 475 ... (20x)
under 64-way load:
  current -> 950 950 950 ... (20x)          swap -> 475 475 475 ... (20x)
(475 = one payload, 950 = two concatenated)
```

100% detection on the broken server, 0% false positives on the fixed one, load-independent.

### The gate

Place it at **`tests/architecture/state-fifo-pairing.test.ts`**. That root is exempt from the
corresponding-test gate (section "Project Constraints") and still runs under plain `npm test`, so a
regression surfaces in the fast loop rather than only in `test:integration`.
(`tests/integration/` is the alternative; it is equally exempt but only runs via `npm run check`.)

```ts
test(
  "the state FIFO server delivers exactly one payload per reader open",
  { skip: FIFO_SKIP },
  async () => {
    // arrange
    const dir = await mkdtemp(path.join(tmpdir(), "state-fifo-pairing-"));
    const statePath = path.join(dir, "state.json");
    createStateFifo(statePath);
    const first = '{"schemaVersion":2,"marketplaces":{}}\n';
    const second = '{"schemaVersion":2,"marketplaces":{},"x":1}\n';
    const server = startFifoStateServer({ statePath, payloads: [first, second] });
    await server.ready;

    // act: `readFile` is open() -> fstat() -> read(); a loaded runner can
    // deschedule it between those syscalls, which is when a server that
    // reopens the same inode for write cancels this reader's EOF and appends
    // the next payload to it. Holding the fd open across an explicit gap makes
    // that interleaving certain instead of rare.
    const handle = await open(statePath, constants.O_RDONLY);
    await setTimeout(200);
    const firstRead = await handle.readFile("utf8");
    await handle.close();
    const secondRead = await readFile(statePath, "utf8");

    // assert
    assert.equal(firstRead, first, "one reader open must receive exactly one payload");
    assert.equal(secondRead, second);
    assert.deepEqual(await server.complete, { code: 0, signal: null });
    assert.deepEqual(server.messages, ["ready", "served:1", "served:2"]);
    assert.equal((await stat(statePath)).isFIFO(), true);
  },
);
```

`handle.readFile("utf8")` drains to EOF exactly as `readFile(path)` does; opening the handle first
is what lets the gap sit in the right place. Verified working in this exact shape, 12/12 per design
`[VERIFIED: probe output, this session]`.

Two notes for the implementer:

- The 200 ms stall is the *subject* of the test, not a wait-for-convergence, and should say so in a
  comment. It costs 200 ms once.
- Do **not** assert on `server.messages` mid-test (e.g. expecting `["ready", "served:1"]` right
  after the first read). The `served:1` announcement is an IPC round-trip whose arrival is genuinely
  racy; only the post-`complete` assertion is sound.

### Supporting checks

1. **Plant the violation.** Before landing, run the new gate against the *old* `SERVER_SOURCE` and
   confirm it fails. A gate that has never been seen to fire is the failure mode CONVENTIONS.md
   records for `import-x/no-cycle`.
2. **One soak, not in `check`.** Run the two orchestrator tests ~100× under `nproc`-way CPU
   saturation once, locally, as a one-off confirmation. Do not commit it as a test.
3. **Re-run the PR #183 jobs.** The three that failed (`npm run check`, `direct coverage`,
   `sonarcloud`) are the field evidence; `sonarcloud` reproduced on an explicit rerun, so a clean
   rerun there is meaningful. Coverage runs are the worst case and the best signal.

## 10. Known limitations of the recommendation

| Limitation | Impact | Mitigation |
|---|---|---|
| An orchestrator that reads *more* times than there are payloads blocks forever in `open` (the server has exited, so its watchdog is already cleared) and the test hangs to its 60 s timeout instead of failing loudly. | Pre-existing; design C does not change it. | None cheap. Every alternative either keeps the server alive past `complete` (which the tests await) or needs a timer. Document it. |
| A `kill()` on a failure path can leave `state.json.spare-N` behind. | None — both tests `rm -rf` the cwd in `finally`. | None needed. |
| The proof assumes the two reads never overlap. | Holds today; see section 6. | A violation is loud (parse failure plus a short `served:N` count), never silent. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node's `"w"` flag string maps to `O_WRONLY \| O_CREAT \| O_TRUNC` | 2 | Low — the recommendation replaces `"w"` with the numeric `O_WRONLY` regardless, and the blocking behavior is observed, not assumed. |
| A2 | `fifo_open` increments `pipe->readers` before sleeping in `wait_for_partner` | 3 | None — offered only as an explanation; the observable behavior is probe-verified and the conclusion rests on the probe. |

## Sources

### Primary (HIGH confidence)
- `man 7 fifo`, `man 7 pipe`, `man 2 open` — Linux man-pages 6.13, read on this machine
- Probes executed this session (ENXIO/blocked reader, destructive probe, mechanism proof, 80/100/160-run load trials, gate determinism) — outputs pasted inline
- `extensions/pi-claude-marketplace/persistence/state-io.ts:378-400` (the reader)
- `tests/orchestrators/plugin/state-fifo.ts` (198 lines, full read)
- `tests/orchestrators/plugin/reinstall-flow.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts` (both FIFO tests)
- `scripts/check-corresponding-tests.mjs`, `package.json` scripts, `.planning/codebase/CONVENTIONS.md`

### Secondary (MEDIUM confidence)
- Commit `147b63f4a26611c20e7ab3255c7ee8b7f47308ef` (2026-09-09) — introduced the harness

## Metadata

**Confidence breakdown:**
- Bug mechanism: HIGH — reproduced with the real `readFile`, 10/80 under load, matching error shape
- Recommended design: HIGH — 160/160 under the load that breaks the current design, plus a proof
- ENXIO refutation: HIGH — both the hazard and a second, more frequent failure mode measured
- Verification strategy: HIGH — 100%/0% detection measured in both load conditions

**Research date:** 2026-09-13
**Valid until:** stable — POSIX FIFO semantics do not move
