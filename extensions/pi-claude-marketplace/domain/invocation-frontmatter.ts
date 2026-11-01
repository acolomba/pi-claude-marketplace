/**
 * D-CF1-05: frontmatter fields that have no effect on a bridged skill or
 * command. Pi reads only `name`, `description`, `argument-hint`, and
 * `disable-model-invocation`, so each field below asks for something Pi does
 * not do.
 */
const UNHONORED_FIELDS: readonly string[] = Object.freeze([
  // Withholds tools during the invocation; Pi has no per-component tool deny list.
  "disallowed-tools",
  // Runs the invocation on another model; Pi keeps the session's model.
  "model",
  // Sets the thinking effort of the invocation; Pi keeps the session's level.
  "effort",
  // Names the subagent a forked invocation runs in; Pi runs it in the session.
  "agent",
  // `fork` runs the invocation in a subagent; Pi runs it in the session.
  "context",
  // Runs the invocation in the background; Pi runs it in the foreground.
  "background",
  // Hooks scoped to one component; Pi installs hooks per plugin only.
  "hooks",
  // File globs that decide when a skill is offered; Pi offers every skill.
  "paths",
]);

/**
 * D-CF1-05: the one install warning for a skill or command whose frontmatter
 * sets unhonored fields, in the agents bridge's line format. It lists them in
 * frontmatter key order and returns `undefined` when there are none.
 *
 * Some fields Pi ignores are not listed. `allowed-tools` only grants tools,
 * and Pi runs every tool without asking. D-CF1-01 and D-CF1-02 honor
 * `arguments` and `shell`. `user-invocable` is its own divergence, D-CF1-09.
 */
export function droppedInvocationFieldsWarning(
  sourceName: string,
  frontmatter: Readonly<Record<string, unknown>>,
): string | undefined {
  const dropped = Object.keys(frontmatter).filter((field) => UNHONORED_FIELDS.includes(field));
  return dropped.length === 0 ? undefined : `[${sourceName}] dropped fields: ${dropped.join(", ")}`;
}
