# Phase 1: Harness on System Git - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-23
**Phase:** 01-harness-on-system-git
**Areas discussed:** Hermetic environment, Fixtures on system git, HTTPS stand-in, SSH stand-in, Harness self-checks, CI and measurement

Smart discuss, autonomous mode. The roadmap lists no open question for this phase. Every grey-area question was classified as reversible technical, so nothing was asked and every answer below was decided autonomously.

---

## Decided autonomously

[auto] [Hermetic environment] — Q: "How does a test-side git command get its environment?" → Selected: "Built from scratch (PATH, scratch HOME, GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=/dev/null, fixed identity), never a filtered copy of process.env" (reversible technical — decided autonomously: test-only support code, one builder) — alternatives considered: a filtered copy of process.env with a deny list (misses new variables); a wrapper script around node --test (does not cover the processes the suites start).
[auto] [Hermetic environment] — Q: "Where does the one environment builder live?" → Selected: "features/lib/hermetic-git.ts, imported by the unit and integration fixture code" (reversible technical — decided autonomously: moving a module later is a mechanical import change) — alternative considered: a new test/ support module that features/lib imports.
[auto] [Hermetic environment] — Q: "Which processes count as 'a test process' for SG-HRN-04?" → Selected: "Every process the suites start; the node test-runner process itself is left for Phase 2 or 3" (reversible technical — decided autonomously: the scrub boundary is test support code a later phase can widen) — alternative considered: a node --test --import preload that scrubs every test process now.
[auto] [Hermetic environment] — Q: "Which variables does the hermetic test check?" → Selected: "The GIT_CONFIG family, GIT_SSL_CAINFO, GIT_SSH, GIT_SSH_COMMAND, GIT_SSH_VARIANT, SSH_AUTH_SOCK, SSH_ASKPASS, the proxy variables in both cases, XDG_CONFIG_HOME, GIT_TRACE*, GCM_*, CLAUDE_CODE_PLUGIN_PREFER_HTTPS, on top of today's list, with exact key sets" (reversible technical — decided autonomously: a test list).
[auto] [Fixtures on system git] — Q: "What moves to system git in this phase?" → Selected: "Every test-side git operation (fixtures and inspection); git-test-repository.ts keeps its API; only tests of the production module's isomorphic-git contract may keep an import until Phase 3 or 8" (reversible technical — decided autonomously: test code only) — alternative considered: move only the fixture builders and leave inspection on isomorphic-git.
[auto] [Fixtures on system git] — Q: "How are fixture commits kept deterministic?" → Selected: "Fixed identity and counter dates; literal object ids are re-read from the fixture" (reversible technical — decided autonomously: fixture details).
[auto] [Fixtures on system git] — Q: "Sync or async git calls in test support?" → Selected: "Async execFile or spawn, argument arrays, no shell; pack() uses git pack-objects" (reversible technical — decided autonomously: call style inside test helpers) — alternative considered: spawnSync (blocks the worker that may serve the git host).
[auto] [HTTPS stand-in] — Q: "How does system git trust the HTTPS stand-in?" → Selected: "GIT_SSL_CAINFO in RpcGitEnvironment and the harness checks; NODE_EXTRA_CA_CERTS stays for Node fetch" (reversible technical — decided autonomously: one environment key) — alternative considered: http.sslCAInfo in the sandbox .gitconfig (DRV-03 keeps that file absent until a scenario writes it; the environment key outranks it, E-16c).
[auto] [HTTPS stand-in] — Q: "How does the stand-in serve fetch by SHA, and how does the refusing arm refuse it?" → Selected: "Default: protocol v2 passthrough plus reachable-SHA wants for v0; refusing arm: protocol v0 with SHA-in-want disabled for that repository" (reversible technical — decided autonomously: a stand-in arm) — alternative considered: a refusing arm that answers an HTTP error (does not exercise git's own refusal message).
[auto] [SSH stand-in] — Q: "Stub ssh on PATH, or GIT_SSH_COMMAND?" → Selected: "A stub named ssh first on Pi's PATH; GIT_SSH_COMMAND and GIT_SSH stay unset" (reversible technical — decided autonomously: harness wiring) — alternative considered: GIT_SSH_COMMAND (upstream reads it as the probe-skip signal, so the probe path could not be tested); a real sshd (no ssh binary in the sandbox; a new dependency).
[auto] [SSH stand-in] — Q: "What does the stub answer?" → Selected: "git-upload-pack on the HTTPS stand-in's bare repositories; scripted probe arms authenticated, denied, host key, hold; ssh -G config; unregistered hosts fail like unreachable hosts; a request log" (reversible technical — decided autonomously: scripted answers are test data).
[auto] [SSH stand-in] — Q: "Is the stub always installed?" → Selected: "Yes, armed or not; SSH_AUTH_SOCK never reaches Pi; 'no ssh on PATH' is left to Phase 4" (reversible technical — decided autonomously: wiring default).
[auto] [SSH stand-in] — Q: "In what language is the stub written?" → Selected: "A Node script with a shebang, launched through an absolute node path" (reversible technical — decided autonomously: one test file) — alternative considered: a POSIX sh script (harder argv parsing).
[auto] [Harness self-checks] — Q: "Where do the harness's own system-git checks live?" → Selected: "Unit tests of the features/lib modules under test/; no new feature file" (reversible technical — decided autonomously: test placement) — alternative considered: a harness feature file under features/.
[auto] [CI and measurement] — Q: "Which CI jobs log the git version, and how?" → Selected: "A git --version step in every ci.yml job that runs a test suite and in e2e-nightly.yml; none in lint.yml" (reversible technical — decided autonomously: a CI step).
[auto] [CI and measurement] — Q: "Does the e2e suite set CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1 now?" → Selected: "Yes, as its own run variable" (reversible technical — decided autonomously: one variable in one suite).
[auto] [CI and measurement] — Q: "How is the Phase 3 re-baseline count recorded?" → Selected: "Exact count and file list in SUMMARY.md and STATE.md" (reversible technical — decided autonomously: a number in a record).

## Claude's Discretion

None.

## Deferred Ideas

- Scrubbing the node test-runner process environment: Phase 2 or Phase 3.
- Reproducing "no ssh on PATH" in cucumber: Phase 4.
- Re-baselining the cucumber request tables: Phase 3.
