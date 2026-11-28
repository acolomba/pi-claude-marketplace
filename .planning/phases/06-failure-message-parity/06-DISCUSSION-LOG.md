# Phase 6: Failure-Message Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives that were considered.

**Date:** 2026-11-28
**Phase:** 06-failure-message-parity
**Areas discussed:** Message form, Claude Code references, HTTPS auth, Classes with no upstream message, Stderr

---

## Message form

| Option | Description | Selected |
|--------|-------------|----------|
| Upstream text + stderr | Keep `{reason}`; the cause line becomes upstream's per-surface text with `Original error: <redacted stderr>` | |
| Upstream text, no stderr | The same sentences, never git's stderr | |
| Keep placeholders + remedy | Keep today's cause lines; add only upstream's remedy sentences | ✓ |

## Claude Code references

| Option | Description | Selected |
|--------|-------------|----------|
| Swap names only | Product name to Pi, `--debug` to `PI_CLAUDE_MARKETPLACE_DEBUG=1`, the rest verbatim | |
| Drop those sentences | | |
| Keep verbatim | | |

**User's choice (free text):** "swap names, but also use the english skills to rephrase them so they are not exactly like claude code's. apply it to all of these upstream sentences, not just the ones that mention claude" (D-SG-33).

## HTTPS auth

| Option | Description | Selected |
|--------|-------------|----------|
| Upstream single message | One message for rejected, no-credential, and bare 401/403; retire the D-1-02 recipe and the GAUTH-04 cause text | ✓ |
| Upstream + D-1-02 recipe | | |
| Keep Pi's texts | | |

## Classes with no upstream message

| Option | Description | Selected |
|--------|-------------|----------|
| Wrapper + stderr | Show git's redacted stderr, with no Pi-only remedy | ✓ |
| Wrapper + stderr + 1 fix | Plus a dubious-ownership remedy | |
| Pi remedies for all | | |

## Stderr (follow-up on the tension between the message-form and classes answers)

| Option | Description | Selected |
|--------|-------------|----------|
| Stderr only for unclassed | | |
| Stderr everywhere | | |
| No stderr anywhere | | |

**User's choice (free text):** "do whatever we were doing with pi by convention". Claude read the convention from the plugin package-install failure note (`orchestrators/plugin/package-install.ts:393-424`). That note shows the tool's stderr, compacted and bounded. So every git failure shows its redacted, compacted stderr (D-SG-32).

## Claude's Discretion

- The location of the mapping, multi-line cause rendering, trigger precedence, the test layout, and the docs.

## Deferred Ideas

None.
