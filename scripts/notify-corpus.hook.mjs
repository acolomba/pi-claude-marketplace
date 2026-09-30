// fallow-ignore-file unused-file -- `--import` preload that notify-corpus.mjs passes to `node --test`; no module imports it.
import { appendFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";

/**
 * The `--import` preload behind `scripts/notify-corpus.mjs` (D-01).
 *
 * It rewrites every `X.ui.notify(` call in the extension source into a call to a recorder while
 * the module loads, so the committed source never gains a seam. IL-2 keeps every such call in
 * `shared/notification-dispatch.ts`, which makes the match exact. The rewrite evaluates the
 * receiver `X.ui` once and calls `ui.notify` with `this === ui`, so strict call-count mocks on
 * `ctx.ui` still pass.
 *
 * `X` must be a bare identifier. A module that spells any other `ui.notify(` call, such as a
 * member-access receiver (`opts.ctx.ui.notify(`) or a destructured `ui.notify(`, fails to load
 * with an error, because the rewrite would break the first and miss the second.
 *
 * The preload does nothing unless `NOTIFY_CORPUS_OUT` names an output directory. It records only
 * when the process entry point is a `.test.ts` file, so a child that a test forks never adds
 * entries. Each process appends to its own `<pid>.jsonl` file in that directory.
 */

const outputDirectory = process.env.NOTIFY_CORPUS_OUT;
// `X.ui.notify(` where `X` is a bare identifier: no `.`, word, or `$` character precedes it.
const bareReceiverCall = /(?<![\w$.])([A-Za-z_$][\w$]*)\.ui\.notify\(/g;

if (outputDirectory !== undefined && outputDirectory !== "") {
  const entryPoint = process.argv[1] ?? "";
  const recording = entryPoint.endsWith(".test.ts");
  const testFile = path.relative(process.cwd(), entryPoint).split(path.sep).join("/");
  const outputPath = path.join(outputDirectory, `${process.pid}.jsonl`);

  globalThis.__corpusNotify = (ui, ...args) => {
    if (recording) {
      const entry = {
        file: testFile,
        message: args[0],
        severity: args[1] ?? null,
        argc: args.length,
      };
      appendFileSync(outputPath, `${JSON.stringify(entry)}\n`);
    }

    return ui.notify(...args);
  };

  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);

      if (!url.includes("/extensions/pi-claude-marketplace/") || !url.endsWith(".ts")) {
        return result;
      }

      // The hook runs before type stripping, so the source is still TypeScript.
      const text =
        typeof result.source === "string" ? result.source : new TextDecoder().decode(result.source);
      const source = text.replace(bareReceiverCall, "globalThis.__corpusNotify($1.ui, ");
      const calls = text.split("ui.notify(").length - 1;
      const rewritten = text.match(bareReceiverCall)?.length ?? 0;

      if (rewritten !== calls) {
        throw new Error(
          `notify-corpus: ${url} spells ${calls} ui.notify( calls, but only ${rewritten} have ` +
            "the bare `X.ui.notify(` receiver the hook can rewrite",
        );
      }

      return { ...result, source };
    },
  });
}
