# API Coverage — Pi ExtensionAPI

The final scope detector returned `detected: true` (real PLAN bodies plus the Phase 5 ROADMAP section). Full coverage is the starting point; every subtraction is explicit below. The complete 26-member ExtensionAPI surface was enumerated from installed `@earendil-works/pi-coding-agent` 0.87.1 `dist/core/extensions/types.d.ts` using the TypeScript AST. That declaration is read-only authority; the supported peer floor remains 0.86.1.

| capability | decision | reason |
|---|---|---|
| on | INTEGRATE | Preserve registration and guard resources_discover/session_start/rewake/settle paths (05-05, 05-06). |
| registerTool | OPT-OUT | Existing LLM tools already return text/details; no new tool or session-entry output (Phase 4 LLMT-01). |
| registerCommand | INTEGRATE | Guard the existing claude:plugin command and trace its list output (05-01). |
| registerShortcut | OPT-OUT | No shortcut behavior changes in this output phase. |
| registerFlag | OPT-OUT | ctx.mode is host state; no extension flag is introduced. |
| getFlag | OPT-OUT | Mode selection reads ctx.mode, not flags. |
| registerMessageRenderer | OPT-OUT | Session payload transport requires no custom visual renderer. |
| registerMarkdownTransformer | OPT-OUT | Text rendering and bytes stay unchanged. |
| registerEntryRenderer | OPT-OUT | Rendering session entries is outside this transport phase. |
| sendMessage | INTEGRATE | Preserve existing independent exit-2 hook completion injection, with stale-context containment (05-06); never use this as the report transport. |
| sendUserMessage | OPT-OUT | Reports must not introduce user messages or trigger turns. |
| appendEntry | INTEGRATE | Deliver claude-plugin DTOs exclusively from notification-dispatch (05-01 through 05-06). |
| setSessionName | OPT-OUT | Output transport does not rename sessions. |
| getSessionName | OPT-OUT | No payload or selector consumes session names. |
| setLabel | OPT-OUT | Output transport does not label session entries. |
| exec | OPT-OUT | No subprocess or network action is added by the sink. |
| getActiveTools | OPT-OUT | Keep existing consumers unchanged; mode selection does not inspect tool activation. |
| getAllTools | INTEGRATE | Preserve the real one-run inventory snapshot and its existing exact reads (05-01). |
| setActiveTools | OPT-OUT | Mode output must not alter tool activation. |
| getCommands | OPT-OUT | No command inventory consumer is added. |
| setModel | OPT-OUT | Output must not change the user's model. |
| getThinkingLevel | OPT-OUT | No thinking-level dependency in this contract. |
| setThinkingLevel | OPT-OUT | Output must not change inference settings. |
| registerProvider | OPT-OUT | No provider integration belongs to this phase. |
| unregisterProvider | OPT-OUT | No provider lifecycle changes belong to this phase. |
| events | OPT-OUT | No cross-extension event channel or telemetry is introduced. |

The accompanying context contract also integrates readonly plain-string `ctx.mode` and existing `ctx.ui.notify` text delivery (05-01). Preserve context getters and host receivers; never clone their live objects. All other existing context consumers retain their current roles.
