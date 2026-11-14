/**
 * @fileoverview Workflow engine texts a scenario reads, reduced to the facts
 * this extension owns. The engine words the result of its `workflow` tool
 * itself, with a random run id, track and cancel hints, and advice to the
 * model, and a release may reword any of it, so no feature file states that
 * wording.
 *
 * The fact a scenario needs is which workflow the engine started: the name
 * the started script declares, which shows that the name the model copied
 * from a staged command reached the workflow this extension saved
 * (D-PG4-08). A background start reads as one line `started the workflow
 * <name>`. The reader anchors on the first quoted name of the first line and
 * on the word `started`, and throws on any other text, a failed call
 * included, so a real format break fails the scenario with the text in the
 * message.
 */

// The engine's first line names the started script's `meta.name` in quotes.
const STARTED_PATTERN = /"([^"\n]+)"[^\n]*\bstarted\b/u;

/** The text of one result of the workflow engine's `workflow` tool as a scenario states it. */
export function projectWorkflowResult(text: string, failed: boolean): string {
  const name = failed ? undefined : STARTED_PATTERN.exec(text.split("\n")[0] ?? "")?.[1];
  if (name === undefined) {
    const kind = failed ? "failed workflow result" : "workflow result";
    throw new Error(`cannot read the workflow engine's ${kind}: ${JSON.stringify(text)}`);
  }

  return `started the workflow ${name}`;
}
