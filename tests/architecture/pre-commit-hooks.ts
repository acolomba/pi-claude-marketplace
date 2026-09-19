/**
 * The `repo: local` hooks of `.pre-commit-config.yaml`, read out of the
 * configuration text for the gates that pin their wiring.
 *
 * The configuration is a flat list of fixed-shape blocks, so it is read here by
 * line rather than through a YAML library the project does not depend on. A
 * block that stops having this shape stops being found, and every case that
 * names it fails -- which is the reporting these gates want. The map keeps the
 * hooks in file order, so a gate can assert which hook runs first.
 */

/** One `repo: local` hook block, as parsed from `.pre-commit-config.yaml`. */
export interface PreCommitHook {
  readonly id: string;
  readonly entry: string;
  readonly passFilenames: string;
  readonly files: string;
}

/** Parses the `repo: local` hook blocks out of a `.pre-commit-config.yaml` file's text, in file order. */
export function readLocalHooks(configuration: string): Map<string, PreCommitHook> {
  const hooks = new Map<string, PreCommitHook>();
  let current: { id: string; fields: Map<string, string> } | undefined;

  const commit = (): void => {
    if (current !== undefined) {
      hooks.set(current.id, {
        id: current.id,
        entry: current.fields.get("entry") ?? "",
        passFilenames: current.fields.get("pass_filenames") ?? "",
        files: (current.fields.get("files") ?? "").replace(/^'(.*)'$/, "$1"),
      });
    }
  };

  for (const line of configuration.split("\n")) {
    const started = /^ {6}- id: (\S+)$/.exec(line);

    if (started !== null) {
      commit();
      current = { id: started[1] ?? "", fields: new Map() };
      continue;
    }

    const field = /^ {8}(\w+): (.+)$/.exec(line);

    if (field !== null && current !== undefined) {
      current.fields.set(field[1] ?? "", field[2] ?? "");
    }
  }

  commit();
  return hooks;
}
